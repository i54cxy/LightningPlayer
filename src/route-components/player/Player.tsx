import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  CanvasSink,
  Input,
  WrappedAudioBuffer,
  WrappedCanvas,
} from "mediabunny";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { inputFilesState } from "../../shared/atoms/inputFilesState";
import { flipHorizontalState } from "../../shared/atoms/player-controls/flipHorizontalState";
import { flipVerticalState } from "../../shared/atoms/player-controls/flipVerticalState";
import { isMutedState } from "../../shared/atoms/player-controls/isMutedState";
import { rotationState } from "../../shared/atoms/player-controls/rotationState";
import { volumeState } from "../../shared/atoms/player-controls/volumeState";
import { titleBarTextState } from "../../shared/atoms/titleBarTextState";
import { useDimensions } from "../../shared/hooks/useDimensions";
import { IDimensions } from "../../shared/types/dimensions";
import { FullscreenContainer } from "../../ui-components/base/fullscreen-container/FullscreenContainer";
import { PlayerControlOverlay } from "../../ui-components/level-two/player-control-overlay/PlayerControlOverlay";
import { draw } from "./draw";
import { getThumbnail } from "./getThumbnail";
import { PlaybackClock } from "./PlaybackClock";
import { PreviewThumbnailCache } from "./PreviewThumbnailCache";
import { runAudioIterator } from "./runAudioIterator";
import { startVideoIterator } from "./startVideoIterator";
import { updateNextFrame } from "./updateNextFrame";
import { updateProgressBarDOM } from "./updateProgressBarDOM";

export const Player: FC = () => {
  const files = useAtomValue(inputFilesState);
  const currentPlayingFile = files[0];
  const setTitleBarText = useSetAtom(titleBarTextState);
  const flipHorizontal = useAtomValue(flipHorizontalState);
  const flipHorizontalRef = useRef(flipHorizontal);
  const flipVertical = useAtomValue(flipVerticalState);
  const flipVerticalRef = useRef(flipVertical);
  const [isMuted, setIsMuted] = useAtom(isMutedState);
  const rotation = useAtomValue(rotationState);
  const rotationRef = useRef(rotation);
  const [volume, setVolume] = useAtom(volumeState);

  // Progress in seconds. Stored in ref to avoid React re-renders on every frame.
  const progressRef = useRef(0);
  // AudioSink produces audioBufferIterators for audio playback.
  const [currentAudioSink, setCurrentAudioSink] = useState<AudioBufferSink>();
  const audioBufferIteratorRef =
    useRef<AsyncGenerator<WrappedAudioBuffer, void, unknown>>(undefined);
  // VideoSink produces videoFrameIterators for video playback.
  const [currentVideoSink, setCurrentVideoSink] = useState<CanvasSink>();
  const videoFrameIteratorRef =
    useRef<AsyncGenerator<WrappedCanvas, void, unknown>>(undefined);
  // Cache for pre-fetched thumbnails.
  const thumbnailCacheRef = useRef<PreviewThumbnailCache>(undefined);

  // Total duration in seconds.
  // When duration is set, it also means that a file has finished loading.
  const [duration, setDuration] = useState<number | undefined>(undefined);

  // progressRef and the progress bar element are not updated until dragging ends.
  const isDraggingProgressBarRef = useRef<boolean>(false);

  // Audio refs for Web Audio API playback. Always initialized even if no audio track.
  // We use audioContext's time for audio-video sync as well.
  const audioContextRef = useRef<AudioContext>(undefined);
  // AudioNodes queued for play. Needed for cleanup.
  const queuedAudioNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  // Kept as a ref as it doesn't affect rendering.
  const gainNodeRef = useRef<GainNode>(undefined);

  // asyncId for startVideoIterator. Only incremented in startVideoIterator when
  // the user starts a new seek. updateNextFrame checks this asyncId to discard
  // all previous async operations.
  const asyncIdRef = useRef<number>(0);

  // Used by PlayerControlOverlay to toggle play/pause button.
  const [isPlaying, setIsPlaying] = useState(false);
  // Manages playback timing using AudioContext as the master clock.
  const playbackClockRef = useRef<PlaybackClock>(undefined);

  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  // Ref to the HTML Canvas element for rendering.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Used for drawing and updated by resize handler.
  const screenDimensionsRef = useRef<IDimensions>(undefined);
  const screenDimensions = useDimensions(fullscreenContainerRef);

  // We always render 2 frames when we startVideoIterator. First frame
  // is rendered immediately and second frame is stored in nextFrameRef.
  // The render loop renders nextFrame when it's time and kicks off
  // fetching of the next nextFrame.
  const nextFrameRef = useRef<WrappedCanvas>(undefined);

  const cleanupPlayback = () => {
    playbackClockRef.current?.pause();
    nextFrameRef.current = undefined;
    // Stop all queued audio nodes to prevent noise.
    for (const node of queuedAudioNodesRef.current) {
      node.stop();
    }
    queuedAudioNodesRef.current.clear();
    // Dispose iterators.
    audioBufferIteratorRef.current?.return();
    videoFrameIteratorRef.current?.return();
    // Clear the canvas.
    if (canvasRef.current) {
      const ctx = canvasRef.current?.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const play = async () => {
    if (!playbackClockRef.current) {
      console.error("play: playbackClock not initialized.");
      return;
    }
    if (!gainNodeRef.current) {
      console.error("play: gainNode not initialized.");
      return;
    }

    setIsPlaying(true);
    // Resume AudioContext if suspended (required by browser autoplay policy).
    await playbackClockRef.current.audioContext.resume();
    playbackClockRef.current.play();

    if (currentAudioSink) {
      // Start the audio iterator.
      void audioBufferIteratorRef.current?.return();
      audioBufferIteratorRef.current = currentAudioSink.buffers(
        playbackClockRef.current.currentTime,
      );
      void runAudioIterator({
        audioBufferIterator: audioBufferIteratorRef.current,
        gainNode: gainNodeRef.current,
        playbackClock: playbackClockRef.current,
        queuedAudioNodes: queuedAudioNodesRef.current,
      });
    }
  };

  const pause = () => {
    if (!playbackClockRef.current) {
      console.error("pause: playbackClock not initialized.");
      return;
    }

    playbackClockRef.current.pause();
    setIsPlaying(false);

    // Stop all audio nodes that were already queued to play.
    for (const node of queuedAudioNodesRef.current) {
      node.stop();
    }
    queuedAudioNodesRef.current.clear();
    // Dispose iterators to release resources.
    audioBufferIteratorRef.current?.return();
  };

  const seek = useCallback(
    async (time: number) => {
      if (!playbackClockRef.current) {
        console.error("seek: playbackClock not initialized.");
        return;
      }

      if (!canvasRef.current) {
        console.error("seek: canvas not ready.");
        return;
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) {
        console.error("seek: no canvas context.");
        return;
      }

      if (!screenDimensionsRef.current) {
        console.error("seek: screen dimensions not ready.");
        return;
      }

      if (!currentVideoSink) {
        console.error("seek: videoSink not ready.");
        return;
      }

      if (duration === undefined) {
        console.error("seek: duration not set.");
        return;
      }

      progressRef.current = time;
      updateProgressBarDOM({ duration, progress: time });

      playbackClockRef.current.seek(time);
      thumbnailCacheRef.current?.startAutoFill(time);
      await startVideoIterator({
        asyncIdRef,
        ctx,
        flipHorizontal,
        flipVertical,
        nextFrameRef,
        playbackClock: playbackClockRef.current,
        rotation,
        screenDimensions: screenDimensionsRef.current,
        videoFrameIteratorRef,
        videoSink: currentVideoSink,
      });
    },
    [currentVideoSink, duration, flipHorizontal, flipVertical, rotation],
  );

  // Initializing screenDimensionsRef.
  // This needs to happen before loadFile and render loop.
  useEffect(() => {
    if (!screenDimensionsRef.current) {
      if (fullscreenContainerRef.current) {
        const dimensions = {
          height: fullscreenContainerRef.current.offsetHeight,
          width: fullscreenContainerRef.current.offsetWidth,
        };
        screenDimensionsRef.current = dimensions;
        if (canvasRef.current) {
          canvasRef.current.width = dimensions.width;
          canvasRef.current.height = dimensions.height;
        }
      }
    }
  }, []);

  // Update screenDimensionsRef with resize obeserver update.
  useEffect(() => {
    if (screenDimensions) {
      if (
        screenDimensions.height !== screenDimensionsRef.current?.height ||
        screenDimensions.width !== screenDimensionsRef.current?.width
      ) {
        screenDimensionsRef.current = screenDimensions;
        if (canvasRef.current && playbackClockRef.current) {
          canvasRef.current.width = screenDimensions.width;
          canvasRef.current.height = screenDimensions.height;
          // Redraw immediately if paused.
          if (!playbackClockRef.current.isPlaying) {
            seek(playbackClockRef.current.currentTime);
          }
        }
      }
    }
  }, [screenDimensions, seek]);

  // Sync transform refs and redraw when flip/rotation changes while paused.
  useEffect(() => {
    flipHorizontalRef.current = flipHorizontal;
    flipVerticalRef.current = flipVertical;
    rotationRef.current = rotation;
    if (
      playbackClockRef.current &&
      !playbackClockRef.current.isPlaying
    ) {
      seek(playbackClockRef.current.currentTime);
    }
  }, [flipHorizontal, flipVertical, rotation, seek]);

  // Load files.
  useEffect(() => {
    let cancelled = false;

    console.log("file:", currentPlayingFile);

    const loadFile = async () => {
      if (!currentPlayingFile) {
        console.error("loadFile: no file provided to Player.");
        return;
      }

      if (!canvasRef.current) {
        console.error("loadFile: canvas not ready.");
        return;
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) {
        console.error("loadFile: no canvas context.");
        return;
      }

      if (!screenDimensionsRef.current) {
        console.error("loadFile: screen dimensions not ready.");
        return;
      }

      const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(currentPlayingFile),
      });

      const videoTracks = await input.getVideoTracks();
      const videoSink = new CanvasSink(videoTracks[0], {
        fit: "contain", // In case the video changes dimensions over time
        poolSize: 2,
      });
      // Separate video sink for thumbnails to avoid canvas pool conflicts.
      const thumbnailVideoSink = new CanvasSink(videoTracks[0], {
        fit: "contain",
      });
      const duration = await videoTracks[0].computeDuration();

      const audioTracks = await input.getAudioTracks();
      const currentAudioTrack = audioTracks[0];

      // Always create audio infrastructure even if there isn't an audio track.
      const audioContext: AudioContext = new AudioContext({
        sampleRate: currentAudioTrack?.sampleRate,
      });
      console.log(`audioContext's baseLatency: ${audioContext.baseLatency}`);

      let audioSink: AudioBufferSink | undefined;
      if (currentAudioTrack) {
        audioSink = new AudioBufferSink(currentAudioTrack);
      }

      if (!cancelled) {
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        audioContextRef.current = audioContext;

        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNodeRef.current = gainNode;

        // Create PlaybackClock with the AudioContext.
        const playbackClock = new PlaybackClock(audioContext);
        playbackClockRef.current = playbackClock;

        // Dispose previous thumbnail cache if exists.
        thumbnailCacheRef.current?.dispose();
        // Initialize thumbnail cache and start auto-fill.
        const thumbnailCache = new PreviewThumbnailCache({
          duration,
          videoSink: thumbnailVideoSink,
        });
        thumbnailCacheRef.current = thumbnailCache;
        thumbnailCache.startAutoFill();

        setCurrentAudioSink(audioSink);
        setCurrentVideoSink(videoSink);
        setDuration(duration);

        // Render first frame.
        await startVideoIterator({
          asyncIdRef,
          ctx,
          flipHorizontal: flipHorizontalRef.current,
          flipVertical: flipVerticalRef.current,
          nextFrameRef,
          playbackClock,
          rotation: rotationRef.current,
          screenDimensions: screenDimensionsRef.current,
          videoFrameIteratorRef,
          videoSink,
        });
      }
    };

    try {
      loadFile();
    } catch (error) {
      console.error(error);
    }

    return () => {
      cancelled = true;
      cleanupPlayback();
      thumbnailCacheRef.current?.dispose();
    };
  }, [currentPlayingFile]);

  // Start render loop after file is loaded.
  useEffect(() => {
    let cancelled = false;

    const render = (requestFrame = true) => {
      if (cancelled) {
        return;
      }

      if (!canvasRef.current) {
        console.log("render: canvas not ready.");
        return;
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) {
        console.log("render: no canvas context.");
        return;
      }

      if (!screenDimensionsRef.current) {
        console.log("render: screen dimensions not ready.");
        return;
      }

      if (!duration) {
        console.log("render: duration not ready.");
        return;
      }

      if (playbackClockRef.current) {
        const playbackTime = playbackClockRef.current.currentTime;

        if (playbackTime >= duration) {
          // Pause playback once the end is reached.
          pause();
          playbackClockRef.current.seek(duration);
        }

        const nextFrame = nextFrameRef.current;

        // Check if the current playback time has caught up to the next frame.
        if (nextFrame && nextFrame.timestamp <= playbackTime) {
          // console.log(
          //   `render: drawing frame at ${nextFrame.timestamp}, playbackTime: ${playbackTime}`,
          // );
          draw({
            ctx,
            flipHorizontal: flipHorizontalRef.current,
            flipVertical: flipVerticalRef.current,
            rotation: rotationRef.current,
            screenDimensions: screenDimensionsRef.current,
            wrappedCanvas: nextFrame,
          });
          nextFrameRef.current = undefined;

          // Request the next frame.
          updateNextFrame({
            asyncIdRef,
            ctx,
            flipHorizontal: flipHorizontalRef.current,
            flipVertical: flipVerticalRef.current,
            nextFrameRef,
            playbackClock: playbackClockRef.current,
            rotation: rotationRef.current,
            screenDimensions: screenDimensionsRef.current,
            videoFrameIterator: videoFrameIteratorRef.current,
          });
        }

        if (!isDraggingProgressBarRef.current) {
          progressRef.current = playbackTime;
          updateProgressBarDOM({
            duration,
            progress: playbackTime,
          });
        }
      }

      if (requestFrame) {
        requestAnimationFrame(() => render());
      }
    };
    render();

    // Also call the render function on an interval to make sure the video keeps
    // updating even if the tab isn't visible.
    setInterval(() => render(false), 500);

    return () => {
      cancelled = true;
    };
  }, [duration]);

  // Update title bar text with the current file name.
  useEffect(() => {
    setTitleBarText(currentPlayingFile?.name ?? "");
    return () => {
      setTitleBarText("");
    };
  }, [currentPlayingFile, setTitleBarText]);

  // Playback cleanup on unmount only.
  useEffect(() => {
    return () => {
      cleanupPlayback();
      // Suspend audio context to stop scheduled audio.
      playbackClockRef.current?.audioContext.suspend();
    };
  }, []);

  // Sync gain node with volume/mute state.
  // currentAudioSink is included to re-run when audio is (re-)initialized.
  useEffect(() => {
    if (gainNodeRef.current) {
      // Quadratic curve for more natural perceived control.
      gainNodeRef.current.gain.value = isMuted ? 0 : volume * volume;
    }
  }, [currentAudioSink, isMuted, volume]);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  /**
   * Supplied to VolumeControl.
   *
   * @param newVolume from 0 to 1.
   */
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  /**
   * Fetches thumbnail URL at timestamp with the the thumbnail cache.
   * Supplied to PreviewThumbnail.
   *
   * @param timestamp in seconds.
   */
  const getThumbnailCallback = useCallback(
    async (timestamp: number) => {
      if (!thumbnailCacheRef.current) {
        console.error(`getThumbnailCallback: no thumbnailCache.`);
        return;
      }

      return await getThumbnail({
        thumbnailCache: thumbnailCacheRef.current,
        timestamp,
      });
    },

    [],
  );

  if (!currentPlayingFile) {
    return null;
  }

  return (
    <FullscreenContainer ref={fullscreenContainerRef}>
      <PlayerControlOverlay
        duration={duration ?? 0}
        fullscreenContainerRef={fullscreenContainerRef}
        getThumbnail={getThumbnailCallback}
        isDraggingProgressBarRef={isDraggingProgressBarRef}
        isMuted={isMuted}
        isPlaying={isPlaying}
        onMuteToggle={handleMuteToggle}
        onVolumeChange={handleVolumeChange}
        pause={pause}
        play={play}
        progressRef={progressRef}
        seek={seek}
        volume={volume}
      />

      <canvas ref={canvasRef} />
    </FullscreenContainer>
  );
};

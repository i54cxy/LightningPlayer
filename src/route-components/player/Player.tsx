import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  CanvasSink,
  Input,
  InputAudioTrack,
  WrappedAudioBuffer,
  WrappedCanvas,
} from "mediabunny";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { inputFilesState } from "../../shared/atoms/inputFilesState";
import { playbackMessageState } from "../../shared/atoms/playbackMessageState";
import {
  AudioVisualization,
  audioVisualizationState,
} from "../../shared/atoms/player-controls/audioVisualizationState";
import { flipHorizontalState } from "../../shared/atoms/player-controls/flipHorizontalState";
import { flipVerticalState } from "../../shared/atoms/player-controls/flipVerticalState";
import { isMutedState } from "../../shared/atoms/player-controls/isMutedState";
import { playbackSpeedState } from "../../shared/atoms/player-controls/playbackSpeedState";
import { rotationState } from "../../shared/atoms/player-controls/rotationState";
import { volumeState } from "../../shared/atoms/player-controls/volumeState";
import { titleBarTextState } from "../../shared/atoms/titleBarTextState";
import { useDimensions } from "../../shared/hooks/useDimensions";
import { IDimensions } from "../../shared/types/dimensions";
import { isTruthy } from "../../shared/utils/isTruthy";
import { FullscreenContainer } from "../../ui-components/base/fullscreen-container/FullscreenContainer";
import { PlaybackMessage } from "../../ui-components/base/playback-message/PlaybackMessage";
import { PlayerControlOverlay } from "../../ui-components/level-two/player-control-overlay/PlayerControlOverlay";
import { drawAudioWaveform } from "./drawAudioWaveform";
import { drawVideoFrame } from "./drawVideoFrame";
import { getThumbnail } from "./getThumbnail";
import { computeAnalyserWindowMs } from "./computeAnalyserWindowMs";
import { PlaybackClock } from "./PlaybackClock";
import { audioVisualizationCanvasStyles } from "./Player.styles";
import { AUDIO_ANALYSER_FFT_SIZE } from "./Player.types";
import { PreviewThumbnailCache } from "./PreviewThumbnailCache";
import { runAudioIterator } from "./runAudioIterator";
import { startVideoIterator } from "./startVideoIterator";
import { updateNextFrame } from "./updateNextFrame";
import { updateProgressBarDOM } from "./updateProgressBarDOM";
import { updateTimestampDOM } from "./updateTimestampDOM";

export const Player: FC = () => {
  const files = useAtomValue(inputFilesState);
  const currentPlayingFile = files[0];
  const setPlaybackMessage = useSetAtom(playbackMessageState);
  const setTitleBarText = useSetAtom(titleBarTextState);

  const [audioVisualization, setAudioVisualization] = useAtom(
    audioVisualizationState,
  );
  const audioVisualizationRef = useRef(audioVisualization);
  const [flipHorizontal, setFlipHorizontal] = useAtom(flipHorizontalState);
  const flipHorizontalRef = useRef(flipHorizontal);
  const [flipVertical, setFlipVertical] = useAtom(flipVerticalState);
  const flipVerticalRef = useRef(flipVertical);
  const [isMuted, setIsMuted] = useAtom(isMutedState);
  const [playbackSpeed, setPlaybackSpeed] = useAtom(playbackSpeedState);
  const playbackSpeedRef = useRef(playbackSpeed);
  const [rotation, setRotation] = useAtom(rotationState);
  const rotationRef = useRef(rotation);
  const [volume, setVolume] = useAtom(volumeState);

  // All audio tracks from the current file.
  const [audioTracks, setAudioTracks] = useState<InputAudioTrack[]>([]);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(0);

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

  // Whether the current file has video tracks.
  const [hasVideo, setHasVideo] = useState(false);
  // For waveform audio visualization.
  const [analyserNodeWindow, setAnalyserNodeWindow] = useState<
    number | undefined
  >(undefined);

  // progressRef and the progress bar element are not updated until dragging ends.
  const isDraggingProgressBarRef = useRef<boolean>(false);

  // Audio refs for Web Audio API playback. Always initialized even if no audio track.
  // We use audioContext's time for audio-video sync as well.
  const audioContextRef = useRef<AudioContext>(undefined);
  // AudioNodes queued for play. Needed for cleanup.
  const queuedAudioNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  // Kept as a ref as it doesn't affect rendering.
  const gainNodeRef = useRef<GainNode>(undefined);
  // AnalyserNode for audio visualization. Always created with the AudioContext.
  const analyserNodeRef = useRef<AnalyserNode>(undefined);

  // Ref to the audio visualization canvas, rendered on top of the video canvas.
  const audioVisualizationCanvasRef = useRef<HTMLCanvasElement>(null);

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
    // Dispose thumbnail cache.
    thumbnailCacheRef.current?.dispose();
    // Clear the canvas.
    if (canvasRef.current) {
      const ctx = canvasRef.current?.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const playImpl = async () => {
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
        speed: playbackSpeedRef.current,
      });
    }
  };

  const pauseImpl = () => {
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

  const seekImpl = useCallback(
    async (time: number) => {
      if (!playbackClockRef.current) {
        console.error("seek: playbackClock not initialized.");
        return;
      }

      if (duration === undefined) {
        console.error("seek: duration not set.");
        return;
      }

      // Always update clock and progress bar.
      progressRef.current = time;
      updateProgressBarDOM({ duration, progress: time });
      playbackClockRef.current.seek(time);
      // thumbnailCacheRef.current?.startAutoFill(time);

      // Draw frame at new position only if video is present.
      if (currentVideoSink) {
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
      }
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
        if (audioVisualizationCanvasRef.current && canvasRef.current) {
          audioVisualizationCanvasRef.current.width = dimensions.width;
          audioVisualizationCanvasRef.current.height = dimensions.height;
          canvasRef.current.width = dimensions.width;
          canvasRef.current.height = dimensions.height;
        } else {
          console.error("Unexpected intialization error: canvases not ready.");
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
        if (audioVisualizationCanvasRef.current && canvasRef.current) {
          audioVisualizationCanvasRef.current.width = screenDimensions.width;
          audioVisualizationCanvasRef.current.height = screenDimensions.height;
          canvasRef.current.width = screenDimensions.width;
          canvasRef.current.height = screenDimensions.height;
          // Redraw immediately if paused.
          if (playbackClockRef.current && !playbackClockRef.current.isPlaying) {
            seekImpl(playbackClockRef.current.currentTime);
          }
        } else {
          console.error("Unexpected resize error: canvases not ready.");
        }
      }
    }
  }, [screenDimensions, seekImpl]);

  // Sync audioVisualizationRef for stale-closure-safe access in the render loop.
  useEffect(() => {
    audioVisualizationRef.current = audioVisualization;
  }, [audioVisualization]);

  // Sync transform refs and redraw when flip/rotation changes while paused.
  useEffect(() => {
    flipHorizontalRef.current = flipHorizontal;
    flipVerticalRef.current = flipVertical;
    rotationRef.current = rotation;
    if (playbackClockRef.current && !playbackClockRef.current.isPlaying) {
      seekImpl(playbackClockRef.current.currentTime);
    }
  }, [flipHorizontal, flipVertical, rotation, seekImpl]);

  // Load files.
  useEffect(() => {
    let cancelled = false;

    console.log("file:", currentPlayingFile);

    const loadFile = async () => {
      if (!currentPlayingFile) {
        // No file (e.g., after Ctrl+R reload). Clean up and reset state.
        cleanupPlayback();
        thumbnailCacheRef.current = undefined;
        setCurrentAudioSink(undefined);
        setCurrentVideoSink(undefined);
        setDuration(undefined);
        setHasVideo(false);
        setIsPlaying(false);
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

      const allTracks = await input.getTracks();
      console.log("allTracks:", allTracks);

      // Filter to decodable tracks only.
      const decodableTracks = (
        await Promise.all(
          allTracks.map(async (track) =>
            (await track.canDecode()) ? track : undefined,
          ),
        )
      ).filter(isTruthy);

      const audioTracks = decodableTracks.filter((track) =>
        track.isAudioTrack(),
      );
      const videoTracks = decodableTracks.filter((track) =>
        track.isVideoTrack(),
      );

      if (!audioTracks[0] && !videoTracks[0]) {
        throw new Error("loadFile: no decodable video or audio tracks found.");
      }

      // Bail out if cancelled before touching shared refs. A cancelled loadFile
      // (e.g. React StrictMode double-invocation) must not clean up state that
      // a newer, still-live loadFile call has already set up.
      if (cancelled) return;

      // New file has valid tracks. Clean up old playback before setting up new state.
      cleanupPlayback();

      let videoSink: CanvasSink | undefined;
      let thumbnailVideoSink: CanvasSink | undefined;

      if (videoTracks[0]) {
        videoSink = new CanvasSink(videoTracks[0], {
          fit: "contain", // In case the video changes dimensions over time.
          poolSize: 2,
        });
        // Separate video sink for thumbnails to avoid canvas pool conflicts.
        thumbnailVideoSink = new CanvasSink(videoTracks[0], {
          fit: "contain",
        });
      }

      // Get duration from video track if available, otherwise from audio track.
      const durationTrack = videoTracks[0] ? videoTracks[0] : audioTracks[0];
      const duration = await durationTrack!.computeDuration();

      // Always create audio infrastructure even if there isn't an audio track.
      const audioContext: AudioContext = new AudioContext({
        sampleRate: audioTracks[0]?.sampleRate,
      });
      console.log(`audioContext's baseLatency: ${audioContext.baseLatency}`);

      let audioSink: AudioBufferSink | undefined;
      if (audioTracks[0]) {
        audioSink = new AudioBufferSink(audioTracks[0]);
      }

      if (!cancelled) {
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        audioContextRef.current = audioContext;

        const gainNode = audioContext.createGain();
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = AUDIO_ANALYSER_FFT_SIZE;
        gainNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);
        gainNodeRef.current = gainNode;
        analyserNodeRef.current = analyserNode;

        // Create PlaybackClock with the AudioContext.
        const playbackClock = new PlaybackClock(audioContext);
        playbackClockRef.current = playbackClock;

        // Initialize thumbnail cache only if we have video.
        if (thumbnailVideoSink) {
          const thumbnailCache = new PreviewThumbnailCache({
            duration,
            videoSink: thumbnailVideoSink,
          });
          thumbnailCacheRef.current = thumbnailCache;
          // thumbnailCache.startAutoFill();
        } else {
          thumbnailCacheRef.current = undefined;
        }

        setAnalyserNodeWindow(computeAnalyserWindowMs(analyserNode));

        setAudioTracks(audioTracks);
        setAudioVisualization(
          videoTracks[0]
            ? AudioVisualization.Off
            : AudioVisualization.WaveformRealTime,
        );
        setCurrentAudioSink(audioSink);
        setCurrentVideoSink(videoSink);
        setDuration(duration);
        setHasVideo(!!videoTracks[0]);
        setSelectedAudioTrackIndex(0);

        // Reset playback settings when loading a new file.
        setFlipHorizontal(false);
        setFlipVertical(false);
        setIsPlaying(false);
        setPlaybackSpeed(1);
        setRotation(0);

        // Render first frame only if video is present.
        if (videoSink) {
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
      }
    };

    loadFile().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [
    currentPlayingFile,
    setAudioVisualization,
    setFlipHorizontal,
    setFlipVertical,
    setPlaybackSpeed,
    setRotation,
  ]);

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
          pauseImpl();
          playbackClockRef.current.seek(duration);
        }

        const nextFrame = nextFrameRef.current;

        // Check if the current playback time has caught up to the next frame.
        if (nextFrame && nextFrame.timestamp <= playbackTime) {
          // console.log(
          //   `render: drawing frame at ${nextFrame.timestamp}, playbackTime: ${playbackTime}`,
          // );
          drawVideoFrame({
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

        if (
          audioVisualizationRef.current ===
            AudioVisualization.WaveformRealTime &&
          analyserNodeRef.current &&
          audioVisualizationCanvasRef.current
        ) {
          const waveformCtx =
            audioVisualizationCanvasRef.current.getContext("2d");
          if (waveformCtx) {
            drawAudioWaveform({
              analyserNode: analyserNodeRef.current,
              ctx: waveformCtx,
              screenDimensions: screenDimensionsRef.current,
            });
          }
        }

        if (!isDraggingProgressBarRef.current) {
          progressRef.current = playbackTime;
          updateProgressBarDOM({
            duration,
            progress: playbackTime,
          });
          updateTimestampDOM({
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
    document.title = currentPlayingFile?.name ?? "Lighting Player";
    return () => {
      setTitleBarText("");
      document.title = "Lighting Player";
    };
  }, [currentPlayingFile, setTitleBarText]);

  // Update playback message when audio visualization mode changes.
  useEffect(() => {
    if (
      audioVisualization === AudioVisualization.WaveformRealTime &&
      analyserNodeWindow
    ) {
      setPlaybackMessage(`Time window: ${analyserNodeWindow} ms`);
    } else {
      setPlaybackMessage(undefined);
    }
  }, [audioVisualization, analyserNodeWindow, setPlaybackMessage]);

  // Playback cleanup on unmount only.
  useEffect(() => {
    return () => {
      cleanupPlayback();
      audioContextRef.current?.close();
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

  // Sync speed ref and handle live speed changes during playback.
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;

    if (!playbackClockRef.current) return;

    playbackClockRef.current.setSpeed(playbackSpeed);

    // If currently playing, restart audio scheduling with new speed.
    if (playbackClockRef.current.isPlaying && gainNodeRef.current) {
      // Stop all currently queued audio nodes.
      for (const node of queuedAudioNodesRef.current) {
        node.stop();
      }
      queuedAudioNodesRef.current.clear();
      audioBufferIteratorRef.current?.return();

      // Restart audio from current position with new speed.
      if (currentAudioSink) {
        audioBufferIteratorRef.current = currentAudioSink.buffers(
          playbackClockRef.current.currentTime,
        );
        runAudioIterator({
          audioBufferIterator: audioBufferIteratorRef.current,
          gainNode: gainNodeRef.current,
          playbackClock: playbackClockRef.current,
          queuedAudioNodes: queuedAudioNodesRef.current,
          speed: playbackSpeed,
        });
      }
    }
  }, [currentAudioSink, playbackSpeed]);

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
   * Switches audio playback to the selected audio track. Re-initializes the
   * audio context, gain node, playback clock, and audio sink for the new track.
   * Preserves the current playback position.
   *
   * @param index - The index of the audio track to switch to.
   */
  const handleSelectAudioTrack = async (index: number) => {
    if (index === selectedAudioTrackIndex) return;

    const newTrack = audioTracks[index];
    if (!newTrack) {
      console.error("handleSelectAudioTrack: invalid track index.");
      return;
    }

    const currentTime = playbackClockRef.current?.currentTime ?? 0;

    // Stop current audio playback.
    if (isPlaying) {
      pauseImpl();
    }

    // Close old audio context.
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Create new audio infrastructure for the selected track.
    const audioContext = new AudioContext({
      sampleRate: newTrack.sampleRate,
    });
    const gainNode = audioContext.createGain();
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = AUDIO_ANALYSER_FFT_SIZE;
    gainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    gainNode.gain.value = isMuted ? 0 : volume * volume;
    gainNodeRef.current = gainNode;
    analyserNodeRef.current = analyserNode;
    // Keeping it here after the assignments to avoid React Compiler
    // false positive immutability error.
    audioContextRef.current = audioContext;
    setAnalyserNodeWindow(computeAnalyserWindowMs(analyserNode));

    // Recompute duration for audio-only files since different audio tracks
    // may have different durations.
    let seekTime = currentTime;
    if (!hasVideo) {
      const newDuration = await newTrack.computeDuration();
      setDuration(newDuration);
      // Clamp position if new track is shorter.
      if (seekTime > newDuration) {
        seekTime = newDuration;
      }
    }

    const playbackClock = new PlaybackClock(audioContext);
    playbackClock.speed = playbackSpeedRef.current;
    playbackClock.seek(seekTime);
    playbackClockRef.current = playbackClock;

    const audioSink = new AudioBufferSink(newTrack);

    setCurrentAudioSink(audioSink);
    setSelectedAudioTrackIndex(index);

    // Resume playback if it was playing before the switch.
    if (isPlaying) {
      setIsPlaying(true);
      await audioContext.resume();
      playbackClock.play();

      void audioBufferIteratorRef.current?.return();
      audioBufferIteratorRef.current = audioSink.buffers(seekTime);
      runAudioIterator({
        audioBufferIterator: audioBufferIteratorRef.current,
        gainNode,
        playbackClock,
        queuedAudioNodes: queuedAudioNodesRef.current,
        speed: playbackSpeedRef.current,
      });
    }
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

  return (
    <FullscreenContainer ref={fullscreenContainerRef}>
      <canvas ref={canvasRef} />
      <canvas
        css={audioVisualizationCanvasStyles}
        data-visible={audioVisualization !== AudioVisualization.Off}
        ref={audioVisualizationCanvasRef}
      />
      <PlaybackMessage />

      {currentPlayingFile && (
        <PlayerControlOverlay
          audioTracks={audioTracks}
          duration={duration ?? 0}
          fullscreenContainerRef={fullscreenContainerRef}
          getThumbnail={getThumbnailCallback}
          hasVideo={hasVideo}
          isDraggingProgressBarRef={isDraggingProgressBarRef}
          isMuted={isMuted}
          isPlaying={isPlaying}
          onMuteToggle={handleMuteToggle}
          onSelectAudioTrack={handleSelectAudioTrack}
          onVolumeChange={handleVolumeChange}
          pause={pauseImpl}
          play={playImpl}
          progressRef={progressRef}
          seek={seekImpl}
          selectedAudioTrackIndex={selectedAudioTrackIndex}
          volume={volume}
        />
      )}
    </FullscreenContainer>
  );
};

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  Input,
  InputAudioTrack,
  WrappedAudioBuffer,
} from "mediabunny";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { inputFilesState } from "../../shared/atoms/inputFilesState";
import {
  AudioVisualization,
  audioVisualizationState,
} from "../../shared/atoms/player-controls/audioVisualizationState";
import { flipHorizontalState } from "../../shared/atoms/player-controls/flipHorizontalState";
import { flipVerticalState } from "../../shared/atoms/player-controls/flipVerticalState";
import { isMutedState } from "../../shared/atoms/player-controls/isMutedState";
import { playbackSpeedState } from "../../shared/atoms/player-controls/playbackSpeedState";
import { rotationState } from "../../shared/atoms/player-controls/rotationState";
import { showFpsState } from "../../shared/atoms/player-controls/showFpsState";
import { volumeState } from "../../shared/atoms/player-controls/volumeState";
import { titleBarTextState } from "../../shared/atoms/titleBarTextState";
import { useDimensions } from "../../shared/hooks/useDimensions";
import { IDimensions } from "../../shared/types/dimensions";
import { isTruthy } from "../../shared/utils/isTruthy";
import { FullscreenContainer } from "../../ui-components/base/fullscreen-container/FullscreenContainer";
import { PlaybackMessage } from "../../ui-components/base/playback-message/PlaybackMessage";
import { PlayerControlOverlay } from "../../ui-components/level-two/player-control-overlay/PlayerControlOverlay";
import { runAudioIterator } from "./audio/runAudioIterator";
import { computeAnalyserWindowMs } from "./audio-visualization/computeAnalyserWindowMs";
import { computeWaveformOverview } from "./audio-visualization/computeWaveformOverview";
import { drawAudioFrequencyBars } from "./audio-visualization/drawAudioFrequencyBars";
import { drawAudioWaveform } from "./audio-visualization/drawAudioWaveform";
import { drawWaveformOverview } from "./audio-visualization/drawWaveformOverview";
import { DecodeWorkerManager } from "./decode-worker/DecodeWorkerManager";
import { updatePlaybackMessageDOM } from "./dom-updates/updatePlaybackMessageDOM";
import { updateProgressBarDOM } from "./dom-updates/updateProgressBarDOM";
import { updateTimestampDOM } from "./dom-updates/updateTimestampDOM";
import { PlaybackClock } from "./PlaybackClock";
import { audioVisualizationCanvasStyles } from "./Player.styles";
import {
  AUDIO_ANALYSER_FFT_SIZE,
  FPS_SAMPLE_INTERVAL_MS,
  WAVEFORM_OVERVIEW_WINDOW_SEC,
} from "./Player.types";
import { getThumbnail } from "./preview-thumbnail/getThumbnail";
import { PreviewThumbnailCache } from "./preview-thumbnail/PreviewThumbnailCache";
import { getIsPreviewThumbnailEnabled } from "./utils/getIsPreviewThumbnailEnabled";

export const Player: FC = () => {
  const files = useAtomValue(inputFilesState);
  const currentPlayingFile = files[0];
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
  const showFps = useAtomValue(showFpsState);
  const showFpsRef = useRef(showFps);
  const [volume, setVolume] = useAtom(volumeState);

  // All audio tracks from the current file.
  const [audioTracks, setAudioTracks] = useState<InputAudioTrack[]>([]);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(0);

  // Progress in seconds. Stored in ref to avoid React re-renders on every frame.
  const progressRef = useRef(0);
  // Render-loop FPS sampling. Counts rAF-driven render() calls and divides by
  // elapsed wall-clock time once per FPS_SAMPLE_INTERVAL_MS.
  const fpsFrameCountRef = useRef(0);
  const fpsLastSampleTimeRef = useRef(0);
  // AudioSink produces audioBufferIterators for audio playback.
  const [currentAudioSink, setCurrentAudioSink] = useState<AudioBufferSink>();
  const audioBufferIteratorRef =
    useRef<AsyncGenerator<WrappedAudioBuffer, void, unknown>>(undefined);
  // Owns the video decode worker. Persists for the Player's lifetime; recycles
  // its worker per file via terminateWorker(). See canvasRef below for the
  // canvas-transfer lifecycle.
  const decodeManagerRef = useRef<DecodeWorkerManager>(undefined);
  // Cache for pre-fetched thumbnails.
  const thumbnailCacheRef = useRef<PreviewThumbnailCache>(undefined);
  // Total duration in seconds.
  const [duration, setDuration] = useState<number | undefined>(undefined);

  // Whether the current file has video tracks.
  const [hasVideo, setHasVideo] = useState(false);
  // Whether the file-load sequence (track discovery, decode probe, canvas
  // transfer) has finished. Controls PlayerControlOverlay visibility.
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  // Whether the decode performance probe reports the file can be decoded
  // fast enough for preview thumbnails. Gates the thumbnail cache and the
  // PreviewThumbnail UI.
  const [isPreviewThumbnailEnabled, setIsPreviewThumbnailEnabled] =
    useState(false);
  // For real-time audio visualization.
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
  // Precomputed whole-file peak data for the OverviewWaveform visualization.
  // State used to trigger re-render when the data is ready, ref used for access in render loop.
  const [waveformOverviewData, setWaveformOverviewData] = useState<
    Float32Array | undefined
  >(undefined);
  const waveformOverviewDataRef = useRef<Float32Array>(undefined);
  // Window size in seconds for the OverviewWaveform visualization.
  const [waveformOverviewWindowSec, setWaveformOverviewWindowSec] = useState(
    WAVEFORM_OVERVIEW_WINDOW_SEC,
  );
  const waveformOverviewWindowSecRef = useRef(WAVEFORM_OVERVIEW_WINDOW_SEC);

  // Used by PlayerControlOverlay to toggle play/pause button.
  const [isPlaying, setIsPlaying] = useState(false);
  // Manages playback timing using AudioContext as the master clock.
  const playbackClockRef = useRef<PlaybackClock>(undefined);

  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  // Ref to the HTML Canvas element for rendering. Its control is transferred
  // to the decode worker via transferControlToOffscreen during startPlayback —
  // after which the main thread cannot draw to or read from it, and the element
  // can never be transferred again. Each file load terminates the old worker
  // and spawns a new one, so we remount the element (via the canvasGeneration
  // key below) on every file change to hand the new worker a fresh, never-
  // transferred canvas.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Used as the <canvas> React key to force a fresh element (see canvasRef
  // above). Adjusted during render via the React "store info from previous
  // render" pattern: when the file changes we bump the generation, which
  // re-renders and remounts the canvas before the load effect runs.
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const [previousLoadedFile, setPreviousLoadedFile] = useState(
    currentPlayingFile,
  );
  if (previousLoadedFile !== currentPlayingFile) {
    setPreviousLoadedFile(currentPlayingFile);
    setCanvasGeneration((generation) => generation + 1);
  }
  // Used for drawing and updated by resize handler.
  const screenDimensionsRef = useRef<IDimensions>(undefined);
  const screenDimensions = useDimensions(fullscreenContainerRef);

  const cleanupPlayback = () => {
    playbackClockRef.current?.pause();
    // Stop all queued audio nodes to prevent noise.
    for (const node of queuedAudioNodesRef.current) {
      node.stop();
    }
    queuedAudioNodesRef.current.clear();
    // Dispose audio iterator.
    audioBufferIteratorRef.current?.return();
    // Clear the thumbnail cache (revokes blob URLs); the instance is reused.
    thumbnailCacheRef.current?.reset();
    // The decode worker is recycled (terminated + respawned) per load — see the
    // load effect cleanup, which calls decodeManagerRef.current.terminateWorker.
  };

  const playImpl = async () => {
    if (!playbackClockRef.current) {
      console.error("play: playbackClock not initialized.");
      return;
    }
    if (!decodeManagerRef.current) {
      console.error("play: decodeManager not initialized.");
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
    decodeManagerRef.current.setPlaying(true);

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
    if (!decodeManagerRef.current) {
      console.error("pause: decodeManager not initialized.");
      return;
    }

    playbackClockRef.current.pause();
    setIsPlaying(false);
    decodeManagerRef.current.setPlaying(false);

    // Stop all audio nodes that were already queued to play.
    for (const node of queuedAudioNodesRef.current) {
      node.stop();
    }
    queuedAudioNodesRef.current.clear();
    // Dispose iterators to release resources.
    audioBufferIteratorRef.current?.return();
  };

  const seekImpl = useCallback(
    (time: number) => {
      if (!playbackClockRef.current) {
        console.error("seek: playbackClock not initialized.");
        return;
      }
      if (!decodeManagerRef.current) {
        console.error("seek: decodeManager not initialized.");
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
      // Tell the worker to seek and draw at the new position. The worker no-ops
      // if no playback session is set up (audio-only files).
      if (hasVideo) {
        decodeManagerRef.current.seek(time);
      }
    },
    [duration, hasVideo],
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
        if (audioVisualizationCanvasRef.current) {
          audioVisualizationCanvasRef.current.width = dimensions.width;
          audioVisualizationCanvasRef.current.height = dimensions.height;
        } else {
          console.error("Unexpected intialization error: canvas not ready.");
        }
        // The video canvas is sized by the worker on StartPlayback; the main
        // thread cannot touch its dimensions once transferControlToOffscreen
        // has run.
      }
    }
  }, []);

  // Update screenDimensionsRef with resize observer update.
  useEffect(() => {
    if (screenDimensions) {
      if (
        screenDimensions.height !== screenDimensionsRef.current?.height ||
        screenDimensions.width !== screenDimensionsRef.current?.width
      ) {
        screenDimensionsRef.current = screenDimensions;
        if (audioVisualizationCanvasRef.current) {
          audioVisualizationCanvasRef.current.width = screenDimensions.width;
          audioVisualizationCanvasRef.current.height = screenDimensions.height;
        } else {
          console.error("Unexpected resize error: canvas not ready.");
        }
        // Push the new dimensions to the worker; it resizes the offscreen
        // canvas and redraws the last frame on its own.
        decodeManagerRef.current?.updateDrawParams({
          screenDimensions,
        });
      }
    }
  }, [screenDimensions]);

  // Sync audioVisualizationRef for stale-closure-safe access in the render loop.
  useEffect(() => {
    audioVisualizationRef.current = audioVisualization;
  }, [audioVisualization]);

  // Sync showFpsRef for the render loop, and clear the readout when toggled off
  // (the render loop only owns the message while visualization is off).
  useEffect(() => {
    showFpsRef.current = showFps;
    if (!showFps && audioVisualizationRef.current === AudioVisualization.Off) {
      updatePlaybackMessageDOM(undefined);
    }
  }, [showFps]);

  // Sync waveformOverviewWindowSecRef for stale-closure-safe access in the render loop.
  useEffect(() => {
    waveformOverviewWindowSecRef.current = waveformOverviewWindowSec;
  }, [waveformOverviewWindowSec]);

  // Sync transform refs and push transform changes to the worker. The worker
  // re-draws its last frame on UpdateDrawParams so paused-state toggles update
  // the canvas immediately.
  useEffect(() => {
    flipHorizontalRef.current = flipHorizontal;
    flipVerticalRef.current = flipVertical;
    rotationRef.current = rotation;
    decodeManagerRef.current?.updateDrawParams({
      flipHorizontal,
      flipVertical,
      rotation,
    });
  }, [flipHorizontal, flipVertical, rotation]);

  // Load files.
  useEffect(() => {
    let cancelled = false;

    console.log("file:", currentPlayingFile);

    const loadFile = async () => {
      // Unmount PlayerControlOverlay immediately so the user cannot interact
      // with stale controls while the async load sequence runs.
      setIsFileLoaded(false);

      if (!currentPlayingFile) {
        // No file (e.g., after Ctrl+R reload). Clean up and reset state.
        cleanupPlayback();
        thumbnailCacheRef.current = undefined;
        setIsPreviewThumbnailEnabled(false);
        setCurrentAudioSink(undefined);
        setDuration(undefined);
        setHasVideo(false);
        setIsPlaying(false);
        return;
      }

      if (!canvasRef.current) {
        console.error("loadFile: canvas not ready.");
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

        // Initialize the decode worker for this file (only if there's a video
        // track). The worker handles the probe RPC, thumbnail fetching, and the
        // streaming playback session.
        thumbnailCacheRef.current = undefined;
        let fileIsPreviewThumbnailEnabled = false;
        if (
          videoTracks[0] &&
          canvasRef.current &&
          screenDimensionsRef.current
        ) {
          const videoTrackIndex = allTracks.indexOf(videoTracks[0]);
          if (!decodeManagerRef.current) {
            decodeManagerRef.current = new DecodeWorkerManager();
          }
          await decodeManagerRef.current.loadFile({
            blob: currentPlayingFile,
            videoTrackIndex,
          });
          if (cancelled) return;

          // Probe before startPlayback: probing may time out and restart the
          // worker; that restart is safe here because the canvas hasn't been
          // transferred yet (startPlayback is below).
          fileIsPreviewThumbnailEnabled = await getIsPreviewThumbnailEnabled({
            decodeWorkerManager: decodeManagerRef.current,
            duration,
            isCancelled: () => cancelled,
          });
          if (cancelled) return;

          if (fileIsPreviewThumbnailEnabled) {
            thumbnailCacheRef.current = new PreviewThumbnailCache({
              decodeWorkerManager: decodeManagerRef.current,
            });
          }

          // Transfer the canvas (first call only) and set up the playback
          // session in the worker.
          await decodeManagerRef.current.startPlayback({
            canvasElement: canvasRef.current,
            drawParams: {
              flipHorizontal: flipHorizontalRef.current,
              flipVertical: flipVerticalRef.current,
              rotation: rotationRef.current,
              screenDimensions: screenDimensionsRef.current,
            },
          });
          if (cancelled) return;
        }

        // Kick off whole-file peak computation in the background.
        waveformOverviewDataRef.current = undefined;
        if (audioTracks[0]) {
          computeWaveformOverview({
            audioTrack: audioTracks[0],
            duration,
            isCancelled: () => cancelled,
          }).then((waveFormOverviewData) => {
            if (!cancelled) {
              waveformOverviewDataRef.current = waveFormOverviewData;
              setWaveformOverviewData(waveFormOverviewData);
            }
          });
        }

        // Open the playback iterator and draw the first frame at t=0.
        if (videoTracks[0]) {
          decodeManagerRef.current?.seek(0);
        }

        // Batch all state updates. React 18+ batches these into a single
        // render even inside async functions.
        setAnalyserNodeWindow(computeAnalyserWindowMs(analyserNode));
        setAudioTracks(audioTracks);
        setAudioVisualization(
          videoTracks[0]
            ? AudioVisualization.Off
            : AudioVisualization.FrequencyRealTime,
        );
        setIsPreviewThumbnailEnabled(fileIsPreviewThumbnailEnabled);
        setCurrentAudioSink(audioSink);
        setDuration(duration);
        setFlipHorizontal(false);
        setFlipVertical(false);
        setHasVideo(!!videoTracks[0]);
        setIsFileLoaded(true);
        setIsPlaying(false);
        setPlaybackSpeed(1);
        setRotation(0);
        setSelectedAudioTrackIndex(0);
      }
    };

    loadFile().catch(console.error);

    return () => {
      cancelled = true;
      // Kill everything from the old file: terminating the worker instantly
      // stops any in-flight decode on its thread. The manager persists for the
      // Player's lifetime and spawns a fresh worker for the next load (paired
      // with a fresh canvas element); it is disposed on unmount.
      decodeManagerRef.current?.terminateWorker();
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

    // Reset FPS sampling for this loop instance.
    fpsFrameCountRef.current = 0;
    fpsLastSampleTimeRef.current = 0;

    const render = (requestFrame = true) => {
      if (cancelled) {
        return;
      }

      // Sample FPS from rAF-driven calls only (the 500ms interval below also
      // calls render(false) but does not reflect display cadence). When audio
      // visualization is off, the FPS readout owns the playback message; while
      // it is on, the message effect owns it instead.
      if (requestFrame) {
        const now = performance.now();
        if (fpsLastSampleTimeRef.current === 0) {
          fpsLastSampleTimeRef.current = now;
        }
        fpsFrameCountRef.current += 1;
        const elapsed = now - fpsLastSampleTimeRef.current;
        if (elapsed >= FPS_SAMPLE_INTERVAL_MS) {
          const renderFps = Math.round(
            (fpsFrameCountRef.current * 1000) / elapsed,
          );
          fpsFrameCountRef.current = 0;
          fpsLastSampleTimeRef.current = now;
          if (
            showFpsRef.current &&
            audioVisualizationRef.current === AudioVisualization.Off
          ) {
            const decodedFps = decodeManagerRef.current?.decodedFps ?? 0;
            updatePlaybackMessageDOM(
              `Render ${renderFps} fps · Decoded ${decodedFps} fps`,
            );
          }
        }
      }

      if (!analyserNodeRef.current) {
        console.log("render: analyserNode not ready.");
        return;
      }

      if (!audioVisualizationCanvasRef.current) {
        console.log("render: audio visualization canvas not ready.");
        return;
      }

      const vizCtx = audioVisualizationCanvasRef.current.getContext("2d");
      if (!vizCtx) {
        console.log("render: no audio visualization canvas context.");
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

        // Drive the worker's video frame draw. The worker decides whether to
        // draw based on its queued nextFrame's timestamp vs currentTime.
        decodeManagerRef.current?.tick(playbackTime);

        switch (audioVisualizationRef.current) {
          case AudioVisualization.WaveformRealTime: {
            drawAudioWaveform({
              analyserNode: analyserNodeRef.current,
              ctx: vizCtx,
              screenDimensions: screenDimensionsRef.current,
            });
            break;
          }
          case AudioVisualization.FrequencyRealTime: {
            drawAudioFrequencyBars({
              analyserNode: analyserNodeRef.current,
              ctx: vizCtx,
              screenDimensions: screenDimensionsRef.current,
            });
            break;
          }
          case AudioVisualization.OverviewWaveform: {
            drawWaveformOverview({
              ctx: vizCtx,
              currentTime: playbackTime,
              screenDimensions: screenDimensionsRef.current,
              waveformData: waveformOverviewDataRef.current,
              windowSec: waveformOverviewWindowSecRef.current,
            });
            break;
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
    const intervalId = setInterval(() => render(false), 500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
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

  // Update playback message when audio visualization mode or window size changes.
  useEffect(() => {
    if (
      (audioVisualization === AudioVisualization.WaveformRealTime ||
        audioVisualization === AudioVisualization.FrequencyRealTime) &&
      analyserNodeWindow
    ) {
      updatePlaybackMessageDOM(`Time window: ${analyserNodeWindow} ms`);
    } else if (audioVisualization === AudioVisualization.OverviewWaveform) {
      if (!waveformOverviewData) {
        updatePlaybackMessageDOM("Computing waveform overview...");
      } else {
        updatePlaybackMessageDOM(
          `Time window: ${waveformOverviewWindowSec}s. Press +/- to zoom in/out.`,
        );
      }
    } else {
      // Audio visualization is off; the render loop owns the message (FPS).
      updatePlaybackMessageDOM(undefined);
    }
  }, [
    audioVisualization,
    analyserNodeWindow,
    waveformOverviewWindowSec,
    waveformOverviewData,
  ]);

  // Keyboard handler for waveform overview window zoom (+/-).
  useEffect(() => {
    if (audioVisualization !== AudioVisualization.OverviewWaveform) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "-") {
        setWaveformOverviewWindowSec((prev) => (prev < 16 ? prev * 2 : prev));
      } else if (e.key === "+" || e.key === "=") {
        setWaveformOverviewWindowSec((prev) => (prev > 1 ? prev / 2 : prev));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [audioVisualization]);

  // Playback cleanup on unmount only.
  useEffect(() => {
    return () => {
      cleanupPlayback();
      audioContextRef.current?.close();
      decodeManagerRef.current?.dispose();
      decodeManagerRef.current = undefined;
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
      return await getThumbnail({
        thumbnailCache: thumbnailCacheRef.current,
        timestamp,
      });
    },

    [],
  );

  return (
    <FullscreenContainer ref={fullscreenContainerRef}>
      <canvas key={canvasGeneration} ref={canvasRef} />
      <canvas
        css={audioVisualizationCanvasStyles}
        data-visible={audioVisualization !== AudioVisualization.Off}
        ref={audioVisualizationCanvasRef}
      />
      <PlaybackMessage />

      {currentPlayingFile && isFileLoaded && (
        <PlayerControlOverlay
          audioTracks={audioTracks}
          duration={duration ?? 0}
          fullscreenContainerRef={fullscreenContainerRef}
          getThumbnail={getThumbnailCallback}
          hasVideo={hasVideo}
          isDraggingProgressBarRef={isDraggingProgressBarRef}
          isMuted={isMuted}
          isPlaying={isPlaying}
          isPreviewThumbnailEnabled={isPreviewThumbnailEnabled}
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

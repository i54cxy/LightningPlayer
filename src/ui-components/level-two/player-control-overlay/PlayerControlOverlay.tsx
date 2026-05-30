import { InputAudioTrack } from "mediabunny";
import {
  FC,
  MouseEventHandler,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import FullScreenMaximize from "../../../assets/svgs/full-screen-maximize.svg?react";
import FullScreenMinimize from "../../../assets/svgs/full-screen-minimize.svg?react";
import HeadphonesSoundWaveIcon from "../../../assets/svgs/headphones-sound-wave.svg?react";
import PauseIcon from "../../../assets/svgs/pause.svg?react";
import PlayIcon from "../../../assets/svgs/play.svg?react";
import SettingsIcon from "../../../assets/svgs/setting.svg?react";
import { updateProgressBarDOM } from "../../../route-components/player/dom-updates/updateProgressBarDOM";
import { useDimensions } from "../../../shared/hooks/useDimensions";
import { AudioTrackSelector } from "../../base/audio-track-selector/AudioTrackSelector";
import { PlaybackSettings } from "../../base/playback-settings/PlaybackSettings";
import { PreviewThumbnail } from "../../base/preview-thumbnail/PreviewThumbnail";
import { previewThumbnailWidth } from "../../base/preview-thumbnail/PreviewThumbnail.types";
import { Timestamp } from "../../base/timestamp/Timestamp";
import { Tooltip } from "../../base/tooltip/Tooltip";
import { VolumeControl } from "../../level-one/volume-control/VolumeControl";
import { getProgressFromEvent } from "./getProgressFromEvent";
import { getProgressPercentageFromEvent } from "./getProgressPercentageFromEvent";
import {
  audioTrackSelectorPositionStyles,
  bottomControlsButtonStyles,
  bottomControlsContainerStyles,
  buttonControlsContainerStyles,
  centerContainerStyles,
  leftContainerStyles,
  playbackSettingsPositionStyles,
  playButtonStyles,
  playerControlOverlayContainerStyles,
  playerControlTooltipStyles,
  previewThumbnailContainerStyles,
  progressBarContainerStyles,
  progressBarCurrentStyles,
  progressbarThumbStyles,
  progressBarTrackFillStyles,
  progressBarTrackStyles,
  rightContainerStyles,
  tooltipContainerStyles,
  topContainerStyles,
} from "./PlayerControlOverlay.styles";
import {
  ALWAYS_SHOW_OVERLAY,
  IDLE_TIMEOUT_MS,
  PlayerControlElement,
  progressBarCurrentId,
  progressBarThumbId,
} from "./PlayerControlOverlay.types";

export interface IPlayerControlOverlayProps {
  /** The list of available audio tracks. */
  audioTracks: InputAudioTrack[];
  /**
   * Whether preview thumbnails should be rendered. False when the decode
   * performance probe reports the file is too slow for interactive seeking.
   */
  isPreviewThumbnailEnabled: boolean;
  /**
   * Duration in seconds.
   */
  duration: number;
  /**
   * Used for setting fullscreen mode.
   */
  fullscreenContainerRef: RefObject<HTMLDivElement | null>;
  /**
   * Fetches thumbnail URL. Passed to PreviewThumbnail.
   *
   * @param timestamp in seconds.
   */
  getThumbnail: (timestamp: number) => Promise<string | undefined>;
  /**
   * Whether the current file has video tracks.
   * When there are no videos, there are no PreviewThumbnails, and
   * the flip & rotate options in PlaybackSettings are hidden.
   */
  hasVideo: boolean;
  /**
   * A ref to keep track of progress bar's drag state that doesn't trigger rerenders.
   * progressRef and the progress bar element are not updated until dragging ends.
   */
  isDraggingProgressBarRef: RefObject<boolean>;
  isMuted: boolean;
  isPlaying: boolean;
  onMuteToggle: () => void;
  /**
   * Callback when a different audio track is selected.
   *
   * @param index - The index of the selected audio track.
   */
  onSelectAudioTrack: (index: number) => void;
  /**
   * @param volume from 0 to 100. This component simply passes it to VolumeControl.
   */
  onVolumeChange: (volume: number) => void;
  pause: () => void;
  /**
   * Time in seconds.
   */
  play: () => void;
  /**
   * Progress in seconds. Stored in ref for imperative DOM updates.
   */
  progressRef: RefObject<number>;
  /**
   * Time in seconds.
   */
  seek(time: number): void;
  /** The index of the currently selected audio track. */
  selectedAudioTrackIndex: number;
  volume: number;
}

export const PlayerControlOverlay: FC<IPlayerControlOverlayProps> = ({
  audioTracks,
  isPreviewThumbnailEnabled,
  duration,
  fullscreenContainerRef,
  getThumbnail,
  hasVideo,
  isDraggingProgressBarRef,
  isMuted,
  isPlaying,
  onMuteToggle,
  onSelectAudioTrack,
  onVolumeChange,
  pause,
  play,
  progressRef,
  seek,
  selectedAudioTrackIndex,
  volume,
}) => {
  // Toggles the opacity of the whole overlay.
  const [isOverlayShown, setIsOverlayShown] = useState(true);
  // HoverPercentage from 0 to 1. Undefined means not hovering.
  // Used to position PreviewThumbnail and render the fill bar.
  const [hoverPercentage, setHoverPercentage] = useState<number | undefined>(
    undefined,
  );
  // Applies hover styles to progress bar.
  const [isProgressBarHovered, setIsProgressBarHovered] = useState(false);
  const [isAudioTrackSelectorOpen, setIsAudioTrackSelectorOpen] =
    useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // The VolumeControl is hard pinned when the user makes an update to the volume.
  // It stays pinned until the user interacts with another player control element.
  const [isVCHardPinned, setIsVCHardPinned] = useState(false);
  // The VolumeControl is soft pinned when the user hovers over it.
  // It stays pinned until the user moves outside of the left container.
  const [isVCSoftPinned, setIsVCSoftPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastInteractedElementRef = useRef<PlayerControlElement | undefined>(
    undefined,
  );
  const progressBarContainerRef = useRef<HTMLDivElement>(null);
  const shouldBlockIdleHideRef = useRef(false);
  const progressBarContainerDimensions = useDimensions(progressBarContainerRef);

  // Sync shouldBlockIdleHideRef with current state so the idle timer callback
  // always reads the latest values without stale closures.
  useEffect(() => {
    shouldBlockIdleHideRef.current =
      isAudioTrackSelectorOpen || isProgressBarHovered || isSettingsOpen;
  }, [isAudioTrackSelectorOpen, isProgressBarHovered, isSettingsOpen]);

  /**
   * Starts (or restarts) the idle timer. When the timer expires and no
   * blocking condition is active, the overlay will be hidden.
   */
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== undefined) {
      clearTimeout(idleTimerRef.current);
    }
    const startIdleTimerImpl = () => {
      idleTimerRef.current = setTimeout(() => {
        if (shouldBlockIdleHideRef.current) {
          startIdleTimerImpl();
        } else {
          if (!ALWAYS_SHOW_OVERLAY) {
            setIsOverlayShown(false);
          }
        }
      }, IDLE_TIMEOUT_MS);
    };
    startIdleTimerImpl();
  }, []);

  // Start idle timer on mount, clean up on unmount.
  useEffect(() => {
    startIdleTimer();
    return () => {
      if (idleTimerRef.current !== undefined) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [startIdleTimer]);

  /**
   * Centralized handler for player control interactions. Manages cleanup of
   * states that should reset when a different control element is interacted with.
   *
   * @param element - The player control element that was interacted with.
   */
  const handleInteraction = (element: PlayerControlElement) => {
    if (element !== PlayerControlElement.AudioTrackButton) {
      setIsAudioTrackSelectorOpen(false);
    }
    if (
      element !== PlayerControlElement.Timestamp &&
      element !== PlayerControlElement.VolumeControl
    ) {
      setIsVCHardPinned(false);
    }
    if (element !== PlayerControlElement.SettingsButton) {
      setIsSettingsOpen(false);
    }
    lastInteractedElementRef.current = element;
  };

  /** Play button toggles playback. */
  const handleOnClickPlayButton = () => {
    handleInteraction(PlayerControlElement.PlayButton);
    if (!isPlaying) {
      play();
    } else {
      pause();
    }
  };

  /** Fullscreen button toggles if the player is fullscreen. */
  const handleOnClickFullscreenButton = async () => {
    handleInteraction(PlayerControlElement.FullscreenButton);
    if (fullscreenContainerRef.current) {
      if (!isFullscreen) {
        fullscreenContainerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      setIsFullscreen((isFullscreen) => !isFullscreen);
    }
  };

  /** Settings button toggles playback settings menu. */
  const handleOnClickSettingsButton = () => {
    handleInteraction(PlayerControlElement.SettingsButton);
    setIsSettingsOpen(!isSettingsOpen);
  };

  /** Audio track button toggles audio track selector menu. */
  const handleOnClickAudioTrackButton = () => {
    handleInteraction(PlayerControlElement.AudioTrackButton);
    setIsAudioTrackSelectorOpen(!isAudioTrackSelectorOpen);
  };

  /** Selects an audio track and closes the menu. */
  const handleSelectAudioTrack = (index: number) => {
    onSelectAudioTrack(index);
    setIsAudioTrackSelectorOpen(false);
  };

  /** Clicking on the overlay toggles playback. */
  const handleOnMouseDownOverlay: MouseEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.button === 0) {
      handleInteraction(PlayerControlElement.Overlay);
      if (!isPlaying) {
        play();
      } else {
        pause();
      }
    }
  };

  /** Shows the overlay and starts the idle timer on mouse enter. */
  const handleOnMouseEnterOverlay = () => {
    // console.log("hovered");
    setIsOverlayShown(true);
    startIdleTimer();
  };

  /** Hides the overlay and clears the idle timer on mouse leave. */
  const handleOnMouseLeaveOverlay = () => {
    if (!ALWAYS_SHOW_OVERLAY) {
      setIsOverlayShown(false);
    }
    if (idleTimerRef.current !== undefined) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = undefined;
    }
  };

  /** Shows the overlay (if hidden by idle) and resets the idle timer on mouse move. */
  const handleOnMouseMoveOverlay = () => {
    if (!isOverlayShown) {
      setIsOverlayShown(true);
    }
    startIdleTimer();
  };

  /** Set progressBarHovered state. */
  const handleOnMouseEnterProgressBar = () => {
    setIsProgressBarHovered(true);
  };

  /** Unset progressBarHovered state.*/
  const handleOnMouseLeaveProgressBar = () => {
    setIsProgressBarHovered(false);
    // Keep hoverPercentage value so thumbnail stays in place during fade-out.
  };

  /** Manage seek and dragging behavior on progress bar. */
  const handleOnMouseDownProgressBar: MouseEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handleInteraction(PlayerControlElement.ProgressBar);

    const newProgress = getProgressFromEvent({
      duration,
      event,
      progressBarContainerRef,
    });
    console.log(
      `Seeking started at: percentage ${progressRef.current / duration}, progress ${newProgress}`,
    );

    if (isPlaying) {
      pause();
    }

    // Drag handlers.
    const handleMouseMove = (e: MouseEvent) => {
      const newProgress = getProgressFromEvent({
        duration,
        event: e,
        progressBarContainerRef,
      });
      console.log(
        `Seeking moving at: percentage ${progressRef.current / duration}, progress ${newProgress}`,
      );
      progressRef.current = newProgress;
      updateProgressBarDOM({ duration, progress: newProgress });
      isDraggingProgressBarRef.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      const newProgress = getProgressFromEvent({
        duration,
        event: e,
        progressBarContainerRef,
      });
      console.log("Seeking ended.");

      seek(newProgress);
      isDraggingProgressBarRef.current = false;

      if (isPlaying) {
        play();
      }

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  /** Updates hoverPercentage state for PreviewThumbnail and fill bar. */
  const handleOnMouseMoveProgressBar: MouseEventHandler<HTMLDivElement> = (
    event,
  ) => {
    const percentage = getProgressPercentageFromEvent({
      event,
      progressBarContainerRef,
    });
    setHoverPercentage(percentage);
  };

  /** Called when the user interacts with the volume slider. */
  const handleVolumeControlInteraction = () => {
    handleInteraction(PlayerControlElement.VolumeControl);
    setIsVCHardPinned(true);
  };
  const handleOnMouseEnterVolumeControl = () => {
    setIsVCSoftPinned(true);
  };
  /** Called when the user clicks on the timestamp. */
  const handleTimestampInteraction = () => {
    handleInteraction(PlayerControlElement.Timestamp);
  };

  const handleOnMouseLeaveLeftContainer = () => {
    setIsVCSoftPinned(false);
  };

  // Calculate previewThumbnailLeft. When progressBarContainerDimensions is
  // not ready, fall back to minLeft which is the position at 0 second.
  const containerWidth = progressBarContainerDimensions?.width ?? 0;
  const rawPosition = (hoverPercentage ?? 0) * containerWidth;
  const minLeft = previewThumbnailWidth / 2;
  const maxLeft = containerWidth - previewThumbnailWidth / 2;
  const previewThumbnailLeft = Math.max(
    minLeft,
    Math.min(maxLeft, rawPosition),
  );

  return (
    <div
      css={playerControlOverlayContainerStyles}
      data-is-overlay-shown={isOverlayShown}
      onMouseEnter={handleOnMouseEnterOverlay}
      onMouseLeave={handleOnMouseLeaveOverlay}
      onMouseMove={handleOnMouseMoveOverlay}
    >
      <div css={topContainerStyles} onMouseDown={handleOnMouseDownOverlay} />
      <div css={bottomControlsContainerStyles}>
        {/* ProgressBar container */}
        <div
          css={progressBarContainerStyles}
          data-is-progress-bar-hovered={isProgressBarHovered}
          onMouseDown={handleOnMouseDownProgressBar}
          onMouseEnter={handleOnMouseEnterProgressBar}
          onMouseMove={handleOnMouseMoveProgressBar}
          onMouseLeave={handleOnMouseLeaveProgressBar}
          ref={progressBarContainerRef}
        >
          {/* Preview thumbnail - only for files with video and when the
              decode-performance probe says the file is fast enough. */}
          {hasVideo && isPreviewThumbnailEnabled && (
            <div
              css={[
                previewThumbnailContainerStyles,
                { left: previewThumbnailLeft },
              ]}
            >
              <PreviewThumbnail
                getThumbnail={getThumbnail}
                timestamp={(hoverPercentage ?? 0) * duration}
              />
            </div>
          )}
          {/* Main progress bar */}
          <div css={progressBarTrackStyles}>
            <div
              css={[
                progressBarTrackFillStyles,
                {
                  width: `${(hoverPercentage ?? 0) * 100}%`,
                },
              ]}
            />
          </div>
          <div css={progressBarCurrentStyles} id={progressBarCurrentId}></div>
          <div css={progressbarThumbStyles} id={progressBarThumbId} />
        </div>
        {/* Button controls */}
        <div css={buttonControlsContainerStyles}>
          <div
            onMouseLeave={handleOnMouseLeaveLeftContainer}
            css={leftContainerStyles}
          >
            <VolumeControl
              isMuted={isMuted}
              isPinned={isVCHardPinned || isVCSoftPinned}
              onInteraction={handleVolumeControlInteraction}
              onMouseEnter={handleOnMouseEnterVolumeControl}
              onMuteToggle={onMuteToggle}
              onVolumeChange={onVolumeChange}
              toolTipBoundsRef={progressBarContainerRef}
              volume={volume}
            />
            <Timestamp
              duration={duration}
              onInteraction={handleTimestampInteraction}
            />
          </div>
          <div css={centerContainerStyles}>
            <Tooltip
              boundsRef={progressBarContainerRef}
              css={tooltipContainerStyles}
              // showTooltip={true}
              text={isPlaying ? "Pause" : "Play"}
              tooltipStylesOverride={playerControlTooltipStyles}
            >
              <button
                aria-label={isPlaying ? "Pause" : "Play"}
                css={playButtonStyles}
                onClick={handleOnClickPlayButton}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
            </Tooltip>
          </div>
          <div css={rightContainerStyles}>
            {audioTracks.length > 1 && (
              <Tooltip
                boundsRef={progressBarContainerRef}
                css={tooltipContainerStyles}
                showTooltip={isAudioTrackSelectorOpen ? false : undefined}
                text={"Audio Track"}
                tooltipStylesOverride={playerControlTooltipStyles}
              >
                <button
                  aria-label={"Audio Track"}
                  css={bottomControlsButtonStyles}
                  onClick={handleOnClickAudioTrackButton}
                >
                  <HeadphonesSoundWaveIcon />
                </button>
                {isAudioTrackSelectorOpen && (
                  <AudioTrackSelector
                    audioTracks={audioTracks}
                    css={audioTrackSelectorPositionStyles}
                    onSelectTrack={handleSelectAudioTrack}
                    selectedTrackIndex={selectedAudioTrackIndex}
                  />
                )}
              </Tooltip>
            )}
            <Tooltip
              boundsRef={progressBarContainerRef}
              css={tooltipContainerStyles}
              // showTooltip={true}
              text={isFullscreen ? "Exit Full Screen" : "Full Screen"}
              tooltipStylesOverride={playerControlTooltipStyles}
            >
              <button
                aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                css={bottomControlsButtonStyles}
                onClick={handleOnClickFullscreenButton}
              >
                {isFullscreen ? <FullScreenMinimize /> : <FullScreenMaximize />}
              </button>
            </Tooltip>
            <Tooltip
              boundsRef={progressBarContainerRef}
              css={tooltipContainerStyles}
              showTooltip={isSettingsOpen ? false : undefined}
              text={"Playback Settings"}
              tooltipStylesOverride={playerControlTooltipStyles}
            >
              <button
                aria-label={"Playback Settings"}
                css={bottomControlsButtonStyles}
                onClick={handleOnClickSettingsButton}
              >
                <SettingsIcon />
              </button>
              {isSettingsOpen && (
                <PlaybackSettings
                  css={playbackSettingsPositionStyles}
                  hasVideo={hasVideo}
                />
              )}
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

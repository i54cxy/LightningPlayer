import { InputAudioTrack } from "mediabunny";
import { FC, MouseEventHandler, RefObject, useRef, useState } from "react";
import FullScreenMaximize from "../../../assets/svgs/full-screen-maximize.svg?react";
import FullScreenMinimize from "../../../assets/svgs/full-screen-minimize.svg?react";
import HeadphonesSoundWaveIcon from "../../../assets/svgs/headphones-sound-wave.svg?react";
import PauseIcon from "../../../assets/svgs/pause.svg?react";
import PlayIcon from "../../../assets/svgs/play.svg?react";
import SettingsIcon from "../../../assets/svgs/setting.svg?react";
import { updateProgressBarDOM } from "../../../route-components/player/updateProgressBarDOM";
import { useDimensions } from "../../../shared/hooks/useDimensions";
import { AudioTrackSelector } from "../../base/audio-track-selector/AudioTrackSelector";
import { PlaybackSettings } from "../../base/playback-settings/PlaybackSettings";
import { PreviewThumbnail } from "../../base/preview-thumbnail/PreviewThumbnail";
import { previewThumbnailWidth } from "../../base/preview-thumbnail/PreviewThumbnail.styles";
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
import { PlayerControlElement } from "./PlayerControlOverlay.types";

export interface IPlayerControlOverlayProps {
  /** The list of available audio tracks. */
  audioTracks: InputAudioTrack[];
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
  seek(time: number): Promise<void>;
  /** The index of the currently selected audio track. */
  selectedAudioTrackIndex: number;
  volume: number;
}

export const PlayerControlOverlay: FC<IPlayerControlOverlayProps> = ({
  audioTracks,
  duration,
  fullscreenContainerRef,
  getThumbnail,
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
  const [isHovered, setIsHovered] = useState(true);
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

  const lastInteractedElementRef = useRef<PlayerControlElement | undefined>(
    undefined,
  );
  const progressBarContainerRef = useRef<HTMLDivElement>(null);
  const progressBarContainerDimensions = useDimensions(progressBarContainerRef);

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
    if (element !== PlayerControlElement.VolumeControl) {
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

  /** Set isHovered state that renders the overlay. */
  const handleOnMouseEnterOverlay = () => {
    // console.log("hovered");
    setIsHovered(true);
  };

  /** Unset isHovered state that hides the overlay. */
  const handleOnMouseLeaveOverlay = () => {
    setIsHovered(false);
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
      data-is-hovered={isHovered}
      onMouseEnter={handleOnMouseEnterOverlay}
      onMouseLeave={handleOnMouseLeaveOverlay}
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
          {/* Preview thumbnail */}
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
          <div css={progressBarCurrentStyles} id="progress-bar-current"></div>
          <div css={progressbarThumbStyles} id="progress-bar-thumb" />
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
                disabled={audioTracks.length === 0}
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
                <PlaybackSettings css={playbackSettingsPositionStyles} />
              )}
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

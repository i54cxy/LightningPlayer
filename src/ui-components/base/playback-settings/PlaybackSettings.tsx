import { FC, useState } from "react";
import ChevronRightIcon from "../../../assets/svgs/chevron-right.svg?react";
import FlipHorizontalIcon from "../../../assets/svgs/flip-horizontal.svg?react";
import RotateClockwiseIcon from "../../../assets/svgs/rotate-clockwise.svg?react";
import SoundWaveCircleSparkleIcon from "../../../assets/svgs/sound-wave-circle-sparkle.svg?react";
import SpeedometerIcon from "../../../assets/svgs/speedometer.svg?react";
import { playbackSettingsContainerStyles } from "./PlaybackSettings.styles";
import { PlaybackSettingsMenu } from "./PlaybackSettings.types";
import { PlaybackSettingsAudioVisualizationMenu } from "./PlaybackSettingsAudioVisualizationMenu";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { PlaybackSettingsFlipMenu } from "./PlaybackSettingsFlipMenu";
import { PlaybackSettingsRotationMenu } from "./PlaybackSettingsRotationMenu";
import { PlaybackSettingsSpeedMenu } from "./PlaybackSettingsSpeedMenu";

export interface IPlaybackSettingsProps {
  /** Style override for the outmost container. */
  className?: string;
  /** Whether the current file has video tracks. Controls flip/rotate menu visibility. */
  hasVideo: boolean;
}

/**
 * A popup settings menu that appears above the progress bar, on top of the settings button.
 * Supports navigation between a main menu and sub-menus.
 *
 * @returns The playback settings component.
 */
export const PlaybackSettings: FC<IPlaybackSettingsProps> = ({
  className,
  hasVideo,
}) => {
  const [currentMenu, setCurrentMenu] = useState(PlaybackSettingsMenu.Main);

  const handleAudioVisualizationOnBack = () =>
    setCurrentMenu(PlaybackSettingsMenu.Main);

  const handleFlipOnBack = () => setCurrentMenu(PlaybackSettingsMenu.Main);

  const handleOnAudioVisualizationClick = () =>
    setCurrentMenu(PlaybackSettingsMenu.AudioVisualization);

  const handleOnFlipClick = () => setCurrentMenu(PlaybackSettingsMenu.Flip);

  const handleOnRotationClick = () =>
    setCurrentMenu(PlaybackSettingsMenu.Rotation);

  const handleOnSpeedClick = () => setCurrentMenu(PlaybackSettingsMenu.Speed);

  const handleRotationOnBack = () => setCurrentMenu(PlaybackSettingsMenu.Main);

  const handleSpeedOnBack = () => setCurrentMenu(PlaybackSettingsMenu.Main);

  return (
    <div className={className} css={playbackSettingsContainerStyles}>
      {currentMenu === PlaybackSettingsMenu.Main && (
        <>
          <PlaybackSettingsChip
            icon={<SoundWaveCircleSparkleIcon />}
            onClick={handleOnAudioVisualizationClick}
            rightIcon={<ChevronRightIcon />}
            text="Audio Visualization"
          />
          {hasVideo && (
            <PlaybackSettingsChip
              icon={<FlipHorizontalIcon />}
              onClick={handleOnFlipClick}
              rightIcon={<ChevronRightIcon />}
              text="Flip"
            />
          )}
          {hasVideo && (
            <PlaybackSettingsChip
              icon={<RotateClockwiseIcon />}
              onClick={handleOnRotationClick}
              rightIcon={<ChevronRightIcon />}
              text="Rotate"
            />
          )}
          <PlaybackSettingsChip
            icon={<SpeedometerIcon />}
            onClick={handleOnSpeedClick}
            rightIcon={<ChevronRightIcon />}
            text="Speed"
          />
        </>
      )}
      {currentMenu === PlaybackSettingsMenu.AudioVisualization && (
        <PlaybackSettingsAudioVisualizationMenu
          onBack={handleAudioVisualizationOnBack}
        />
      )}
      {currentMenu === PlaybackSettingsMenu.Flip && (
        <PlaybackSettingsFlipMenu onBack={handleFlipOnBack} />
      )}
      {currentMenu === PlaybackSettingsMenu.Rotation && (
        <PlaybackSettingsRotationMenu onBack={handleRotationOnBack} />
      )}
      {currentMenu === PlaybackSettingsMenu.Speed && (
        <PlaybackSettingsSpeedMenu onBack={handleSpeedOnBack} />
      )}
    </div>
  );
};

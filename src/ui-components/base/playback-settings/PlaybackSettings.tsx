import { FC, useState } from "react";
import ChevronRightIcon from "../../../assets/svgs/chevron-right.svg?react";
import FlipHorizontalIcon from "../../../assets/svgs/flip-horizontal.svg?react";
import RotateClockwiseIcon from "../../../assets/svgs/rotate-clockwise.svg?react";
import SpeedometerIcon from "../../../assets/svgs/speedometer.svg?react";
import { playbackSettingsContainerStyles } from "./PlaybackSettings.styles";
import { PlaybackSettingsMenu } from "./PlaybackSettings.types";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { PlaybackSettingsFlipMenu } from "./PlaybackSettingsFlipMenu";
import { PlaybackSettingsRotationMenu } from "./PlaybackSettingsRotationMenu";
import { PlaybackSettingsSpeedMenu } from "./PlaybackSettingsSpeedMenu";

export interface IPlaybackSettingsProps {
  /** Style override for the outmost container. */
  className?: string;
}

/**
 * A popup settings menu that appears above the progress bar, on top of the settings button.
 * Supports navigation between a main menu and sub-menus.
 *
 * @returns The playback settings component.
 */
export const PlaybackSettings: FC<IPlaybackSettingsProps> = ({ className }) => {
  const [currentMenu, setCurrentMenu] = useState(PlaybackSettingsMenu.Main);

  const handleFlipOnBack = () => setCurrentMenu(PlaybackSettingsMenu.Main);

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
            icon={<FlipHorizontalIcon />}
            onClick={handleOnFlipClick}
            rightIcon={<ChevronRightIcon />}
            text="Flip"
          />
          <PlaybackSettingsChip
            icon={<RotateClockwiseIcon />}
            onClick={handleOnRotationClick}
            rightIcon={<ChevronRightIcon />}
            text="Rotate"
          />
          <PlaybackSettingsChip
            icon={<SpeedometerIcon />}
            onClick={handleOnSpeedClick}
            rightIcon={<ChevronRightIcon />}
            text="Speed"
          />
        </>
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

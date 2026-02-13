import { FC, useState } from "react";
import ChevronRightIcon from "../../../assets/svgs/chevron-right.svg?react";
import FlipHorizontalIcon from "../../../assets/svgs/flip-horizontal.svg?react";
import RotateClockwiseIcon from "../../../assets/svgs/rotate-clockwise.svg?react";
import { playbackSettingsContainerStyles } from "./PlaybackSettings.styles";
import { PlaybackSettingsMenu } from "./PlaybackSettings.types";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { PlaybackSettingsFlipMenu } from "./PlaybackSettingsFlipMenu";
import { PlaybackSettingsRotationMenu } from "./PlaybackSettingsRotationMenu";

/**
 * A popup settings menu that appears above the progress bar, on top of the settings button.
 * Supports navigation between a main menu and sub-menus.
 *
 * @returns The playback settings component.
 */
export const PlaybackSettings: FC = () => {
  const [currentMenu, setCurrentMenu] = useState(PlaybackSettingsMenu.Main);

  const handleFlipOnBack = () => setCurrentMenu(PlaybackSettingsMenu.Main);

  const handleOnFlipClick = () =>
    setCurrentMenu(PlaybackSettingsMenu.Flip);

  const handleOnRotationClick = () =>
    setCurrentMenu(PlaybackSettingsMenu.Rotation);

  const handleRotationOnBack = () => setCurrentMenu(PlaybackSettingsMenu.Main);

  return (
    <div css={playbackSettingsContainerStyles}>
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
        </>
      )}
      {currentMenu === PlaybackSettingsMenu.Flip && (
        <PlaybackSettingsFlipMenu onBack={handleFlipOnBack} />
      )}
      {currentMenu === PlaybackSettingsMenu.Rotation && (
        <PlaybackSettingsRotationMenu onBack={handleRotationOnBack} />
      )}
    </div>
  );
};

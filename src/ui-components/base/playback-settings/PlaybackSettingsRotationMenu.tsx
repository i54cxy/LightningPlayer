import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import RotateClockwiseIcon from "../../../assets/svgs/rotate-clockwise.svg?react";
import RotateCounterclockwiseIcon from "../../../assets/svgs/rotate-counterclockwise.svg?react";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import {
  backButtonStyles,
  backButtonTextStyles,
  separatorStyles,
} from "./PlaybackSettingsRotationMenu.styles";

export interface IPlaybackSettingsRotationMenuProps {
  /** Callback to navigate back to the main settings menu. */
  onBack: () => void;
}

/**
 * A sub-menu within PlaybackSettings for video rotation options.
 * Displays a back button, separator, and rotation action chips.
 *
 * @param props - The component props.
 * @param props.onBack - Callback to navigate back to the main menu.
 * @returns The rotation menu component.
 */
export const PlaybackSettingsRotationMenu: FC<
  IPlaybackSettingsRotationMenuProps
> = ({ onBack }) => {
  return (
    <>
      <button css={backButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={backButtonTextStyles}>Rotate</span>
      </button>
      <hr css={separatorStyles} />
      <PlaybackSettingsChip
        icon={<RotateClockwiseIcon />}
        onClick={() => console.log("Rotate clockwise 90°")}
        text="Rotate clockwise 90°"
      />
      <PlaybackSettingsChip
        icon={<RotateCounterclockwiseIcon />}
        onClick={() => console.log("Rotate counterclockwise 90°")}
        text="Rotate counterclockwise 90°"
      />
    </>
  );
};

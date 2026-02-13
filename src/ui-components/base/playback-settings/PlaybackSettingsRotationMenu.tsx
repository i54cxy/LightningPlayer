import { useSetAtom } from "jotai";
import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import RotateClockwiseIcon from "../../../assets/svgs/rotate-clockwise.svg?react";
import RotateCounterclockwiseIcon from "../../../assets/svgs/rotate-counterclockwise.svg?react";
import { rotationState } from "../../../shared/atoms/player-controls/rotationState";
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
  const setRotation = useSetAtom(rotationState);

  /** Rotates clockwise by 90 degrees (π/2 radians). */
  const handleRotateClockwise = () => {
    setRotation((prev) => prev + Math.PI / 2);
  };

  /** Rotates counterclockwise by 90 degrees (π/2 radians). */
  const handleRotateCounterclockwise = () => {
    setRotation((prev) => prev - Math.PI / 2);
  };

  return (
    <>
      <button css={backButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={backButtonTextStyles}>Rotate</span>
      </button>
      <hr css={separatorStyles} />
      <PlaybackSettingsChip
        icon={<RotateClockwiseIcon />}
        onClick={handleRotateClockwise}
        text="Rotate clockwise 90°"
      />
      <PlaybackSettingsChip
        icon={<RotateCounterclockwiseIcon />}
        onClick={handleRotateCounterclockwise}
        text="Rotate counterclockwise 90°"
      />
    </>
  );
};

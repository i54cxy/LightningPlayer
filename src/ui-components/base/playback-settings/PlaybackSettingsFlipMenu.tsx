import { useAtom } from "jotai";
import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import FlipHorizontalIcon from "../../../assets/svgs/flip-horizontal.svg?react";
import FlipVerticalIcon from "../../../assets/svgs/flip-vertical.svg?react";
import ResetIcon from "../../../assets/svgs/reset.svg?react";
import { flipHorizontalState } from "../../../shared/atoms/player-controls/flipHorizontalState";
import { flipVerticalState } from "../../../shared/atoms/player-controls/flipVerticalState";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import {
  submenuBackButtonStyles,
  submenuBackButtonTextStyles,
  submenuSeparatorStyles,
} from "./PlaybackSettingsSubMenu.styles";

export interface IPlaybackSettingsFlipMenuProps {
  /** Callback to navigate back to the main settings menu. */
  onBack: () => void;
}

/**
 * A sub-menu within PlaybackSettings for video flip options.
 * Displays a back button, separator, flip action chips, and a reset chip.
 *
 * @param props - The component props.
 * @param props.onBack - Callback to navigate back to the main menu.
 * @returns The flip menu component.
 */
export const PlaybackSettingsFlipMenu: FC<IPlaybackSettingsFlipMenuProps> = ({
  onBack,
}) => {
  const [flipHorizontal, setFlipHorizontal] = useAtom(flipHorizontalState);
  const [flipVertical, setFlipVertical] = useAtom(flipVerticalState);

  /** Toggles horizontal flip. */
  const handleFlipHorizontal = () => {
    setFlipHorizontal((prev) => !prev);
  };

  /** Toggles vertical flip. */
  const handleFlipVertical = () => {
    setFlipVertical((prev) => !prev);
  };

  /** Resets both flip states to false. */
  const handleReset = () => {
    setFlipHorizontal(false);
    setFlipVertical(false);
  };

  return (
    <>
      <button css={submenuBackButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={submenuBackButtonTextStyles}>Flip</span>
      </button>
      <hr css={submenuSeparatorStyles} />
      <PlaybackSettingsChip
        icon={<FlipHorizontalIcon />}
        onClick={handleFlipHorizontal}
        text="Flip horizontally"
      />
      <PlaybackSettingsChip
        icon={<FlipVerticalIcon />}
        onClick={handleFlipVertical}
        text="Flip vertically"
      />
      <hr css={submenuSeparatorStyles} />
      <PlaybackSettingsChip
        disabled={!flipHorizontal && !flipVertical}
        icon={<ResetIcon />}
        onClick={handleReset}
        text="Reset flip"
      />
    </>
  );
};

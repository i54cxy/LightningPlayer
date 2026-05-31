import { useAtom } from "jotai";
import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import { showFpsState } from "../../../shared/atoms/player-controls/showFpsState";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { toggleTextStyles } from "./PlaybackSettingsFlipMenu.styles";
import {
  submenuBackButtonStyles,
  submenuBackButtonTextStyles,
  submenuSeparatorStyles,
} from "./PlaybackSettingsSubMenu.styles";

export interface IPlaybackSettingsDevInfoMenuProps {
  /** Callback to navigate back to the main settings menu. */
  onBack: () => void;
}

/**
 * A sub-menu within PlaybackSettings for developer overlays. Items can be
 * toggled on concurrently, like the flip menu. Currently exposes a single
 * "Show FPS" toggle.
 *
 * @param props - The component props.
 * @param props.onBack - Callback to navigate back to the main menu.
 * @returns The dev info menu component.
 */
export const PlaybackSettingsDevInfoMenu: FC<
  IPlaybackSettingsDevInfoMenuProps
> = ({ onBack }) => {
  const [showFps, setShowFps] = useAtom(showFpsState);

  /** Toggles the FPS readout. */
  const handleToggleShowFps = () => {
    setShowFps((prev) => !prev);
  };

  return (
    <>
      <button css={submenuBackButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={submenuBackButtonTextStyles}>Dev Info</span>
      </button>
      <hr css={submenuSeparatorStyles} />
      <PlaybackSettingsChip
        css={toggleTextStyles}
        data-toggled-on={showFps}
        onClick={handleToggleShowFps}
        text="Show FPS"
      />
    </>
  );
};

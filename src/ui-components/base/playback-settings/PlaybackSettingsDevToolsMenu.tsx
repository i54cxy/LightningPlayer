import { useAtom } from "jotai";
import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import { enablePreviewThumbnailsState } from "../../../shared/atoms/player-controls/enablePreviewThumbnailsState";
import { showFpsState } from "../../../shared/atoms/player-controls/showFpsState";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { toggleTextStyles } from "./PlaybackSettingsFlipMenu.styles";
import {
  submenuBackButtonStyles,
  submenuBackButtonTextStyles,
  submenuSeparatorStyles,
} from "./PlaybackSettingsSubMenu.styles";

export interface IPlaybackSettingsDevToolsMenuProps {
  /** Callback to navigate back to the main settings menu. */
  onBack: () => void;
}

/**
 * A sub-menu within PlaybackSettings for developer tools and overlays. Items can
 * be toggled on concurrently, like the flip menu.
 *
 * @param props - The component props.
 * @param props.onBack - Callback to navigate back to the main menu.
 * @returns The dev tools menu component.
 */
export const PlaybackSettingsDevToolsMenu: FC<
  IPlaybackSettingsDevToolsMenuProps
> = ({ onBack }) => {
  const [enablePreviewThumbnails, setEnablePreviewThumbnails] = useAtom(
    enablePreviewThumbnailsState,
  );
  const [showFps, setShowFps] = useAtom(showFpsState);

  /** Toggles the preview thumbnail prefetch. */
  const handleToggleEnablePreviewThumbnails = () => {
    setEnablePreviewThumbnails((prev) => !prev);
  };

  /** Toggles the FPS readout. */
  const handleToggleShowFps = () => {
    setShowFps((prev) => !prev);
  };

  return (
    <>
      <button css={submenuBackButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={submenuBackButtonTextStyles}>Dev Tools</span>
      </button>
      <hr css={submenuSeparatorStyles} />
      <PlaybackSettingsChip
        css={toggleTextStyles}
        data-toggled-on={showFps}
        onClick={handleToggleShowFps}
        text="Show FPS"
      />
      <PlaybackSettingsChip
        css={toggleTextStyles}
        data-toggled-on={enablePreviewThumbnails}
        onClick={handleToggleEnablePreviewThumbnails}
        text="Show Preview"
      />
    </>
  );
};

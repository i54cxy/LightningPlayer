import { useAtom } from "jotai";
import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import ResetIcon from "../../../assets/svgs/reset.svg?react";
import { playbackSpeedState } from "../../../shared/atoms/player-controls/playbackSpeedState";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { selectedTextStyles } from "./PlaybackSettingsSpeedMenu.styles";
import {
  submenuBackButtonStyles,
  submenuBackButtonTextStyles,
  submenuSeparatorStyles,
} from "./PlaybackSettingsSubMenu.styles";

/** Available speed options displayed in the speed submenu. */
const SPEED_OPTIONS = [
  { label: "0.25x", value: 0.25 },
  { label: "0.5x", value: 0.5 },
  { label: "1.0x (Normal)", value: 1 },
  { label: "1.5x", value: 1.5 },
  { label: "2.0x", value: 2 },
];

export interface IPlaybackSettingsSpeedMenuProps {
  /** Callback to navigate back to the main settings menu. */
  onBack: () => void;
}

/**
 * A sub-menu within PlaybackSettings for playback speed options.
 * Displays a back button, separator, speed option chips, separator,
 * and a reset chip.
 *
 * @param props - The component props.
 * @param props.onBack - Callback to navigate back to the main menu.
 * @returns The speed menu component.
 */
export const PlaybackSettingsSpeedMenu: FC<IPlaybackSettingsSpeedMenuProps> = ({
  onBack,
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useAtom(playbackSpeedState);

  /** Resets speed to 1 (normal). */
  const handleReset = () => {
    setPlaybackSpeed(1);
  };

  /** Sets the playback speed to the given value. */
  const handleSelectSpeed = (value: number) => {
    setPlaybackSpeed(value);
  };

  return (
    <>
      <button css={submenuBackButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={submenuBackButtonTextStyles}>Speed</span>
      </button>
      <hr css={submenuSeparatorStyles} />
      {SPEED_OPTIONS.map((option) => (
        <PlaybackSettingsChip
          css={selectedTextStyles}
          data-toggled-on={playbackSpeed === option.value}
          key={option.value}
          onClick={() => handleSelectSpeed(option.value)}
          text={option.label}
        />
      ))}
      <hr css={submenuSeparatorStyles} />
      <PlaybackSettingsChip
        disabled={playbackSpeed === 1}
        icon={<ResetIcon />}
        onClick={handleReset}
        text="Reset speed"
      />
    </>
  );
};

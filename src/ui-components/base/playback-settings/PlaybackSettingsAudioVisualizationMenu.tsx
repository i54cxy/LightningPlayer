import { useAtom } from "jotai";
import { FC } from "react";
import ChevronLeftIcon from "../../../assets/svgs/chevron-left.svg?react";
import {
  AudioVisualization,
  audioVisualizationState,
} from "../../../shared/atoms/player-controls/audioVisualizationState";
import { PlaybackSettingsChip } from "./PlaybackSettingsChip";
import { selectedTextStyles } from "./PlaybackSettingsSpeedMenu.styles";
import {
  submenuBackButtonStyles,
  submenuBackButtonTextStyles,
  submenuSeparatorStyles,
} from "./PlaybackSettingsSubMenu.styles";

/** Active visualization mode options. */
const VISUALIZATION_OPTIONS = [
  { label: "Frequency Real-Time", value: AudioVisualization.FrequencyRealTime },
  { label: "Waveform Real-Time", value: AudioVisualization.WaveformRealTime },
];

export interface IPlaybackSettingsAudioVisualizationMenuProps {
  /** Callback to navigate back to the main settings menu. */
  onBack: () => void;
}

/**
 * A sub-menu within PlaybackSettings for audio visualization options.
 * Displays a back button, separator, visualization mode chips, a second
 * separator, and the Off chip in its own section at the bottom.
 *
 * @param props - The component props.
 * @param props.onBack - Callback to navigate back to the main menu.
 * @returns The audio visualization menu component.
 */
export const PlaybackSettingsAudioVisualizationMenu: FC<
  IPlaybackSettingsAudioVisualizationMenuProps
> = ({ onBack }) => {
  const [audioVisualization, setAudioVisualization] = useAtom(
    audioVisualizationState,
  );

  /** Sets the audio visualization mode to the given value. */
  const handleSelectVisualization = (value: AudioVisualization) => {
    setAudioVisualization(value);
  };

  return (
    <>
      <button css={submenuBackButtonStyles} onClick={onBack}>
        <ChevronLeftIcon />
        <span css={submenuBackButtonTextStyles}>Audio Visualization</span>
      </button>
      <hr css={submenuSeparatorStyles} />
      {VISUALIZATION_OPTIONS.map((option) => (
        <PlaybackSettingsChip
          css={selectedTextStyles}
          data-toggled-on={audioVisualization === option.value}
          key={option.value}
          onClick={() => handleSelectVisualization(option.value)}
          text={option.label}
        />
      ))}
      <hr css={submenuSeparatorStyles} />
      <PlaybackSettingsChip
        css={selectedTextStyles}
        data-toggled-on={audioVisualization === AudioVisualization.Off}
        onClick={() => handleSelectVisualization(AudioVisualization.Off)}
        text="Off"
      />
    </>
  );
};

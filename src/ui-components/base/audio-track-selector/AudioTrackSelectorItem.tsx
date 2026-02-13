import { FC } from "react";
import CheckmarkIcon from "../../../assets/svgs/checkmark.svg?react";
import {
  itemCheckmarkStyles,
  itemContainerStyles,
  itemTextStyles,
} from "./AudioTrackSelectorItem.styles";

export interface IAudioTrackSelectorItemProps {
  /** Whether this item is the currently selected audio track. */
  isSelected: boolean;
  /** Click handler for selecting this track. */
  onClick: () => void;
  /** The display name of the audio track. */
  text: string;
}

/**
 * A selectable item in the audio track selector menu.
 * Displays the track name with highlighted text and a checkmark when selected.
 *
 * @param props - The component props.
 * @param props.isSelected - Whether this item is selected.
 * @param props.onClick - Click handler.
 * @param props.text - The display name.
 * @returns The audio track selector item component.
 */
export const AudioTrackSelectorItem: FC<IAudioTrackSelectorItemProps> = ({
  isSelected,
  onClick,
  text,
}) => {
  return (
    <button css={itemContainerStyles} onClick={onClick}>
      <span css={itemTextStyles} data-is-selected={isSelected}>
        {text}
      </span>
      {isSelected && (
        <span css={itemCheckmarkStyles}>
          <CheckmarkIcon />
        </span>
      )}
    </button>
  );
};

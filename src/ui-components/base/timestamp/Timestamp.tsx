import { FC } from "react";
import { formatTimestamp } from "../../../shared/utils/formatTimestamp";
import { timestampContainerStyles } from "./Timestamp.styles";

export interface ITimestampProps {
  duration: number;
  onInteraction: () => void;
}

/** Timestamp text element ID for imperative DOM updates. */
export const timestampTextId = "timestamp-text";

/**
 * Displays the current playback timestamp (e.g. "49:24 / 58:27"). Clicking
 * toggles between normal and reversed format (e.g. "-9:03 / 58:27"). Text
 * content is updated imperatively via `updateTimestampDOM` to avoid re-renders.
 */
export const Timestamp: FC<ITimestampProps> = ({ duration, onInteraction }) => {
  const handleClick = () => {
    const element = document.getElementById(timestampTextId);
    if (element) {
      element.dataset.reversed =
        element.dataset.reversed === "true" ? "false" : "true";
    }
    onInteraction();
  };

  return (
    <div css={timestampContainerStyles} onClick={handleClick}>
      <span data-reversed="false" id={timestampTextId}>
        {`${formatTimestamp(0)} / ${formatTimestamp(duration)}`}
      </span>
    </div>
  );
};

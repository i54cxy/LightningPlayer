import { formatTimestamp } from "../../shared/utils/formatTimestamp";
import { timestampTextId } from "../../ui-components/base/timestamp/Timestamp";

/**
 * Imperatively updates the timestamp text to avoid React re-renders.
 * Reads the `data-reversed` attribute to determine the display format.
 *
 * @param params.duration - Video duration in seconds.
 * @param params.progress - Current playback progress in seconds.
 */
export const updateTimestampDOM = ({
  duration,
  progress,
}: {
  duration: number;
  progress: number;
}) => {
  const element = document.getElementById(timestampTextId);
  if (!element) {
    return;
  }

  const isReversed = element.dataset.reversed === "true";
  const currentText = isReversed
    ? `-${formatTimestamp(duration - progress)}`
    : formatTimestamp(progress);

  element.textContent = `${currentText} / ${formatTimestamp(duration)}`;
};

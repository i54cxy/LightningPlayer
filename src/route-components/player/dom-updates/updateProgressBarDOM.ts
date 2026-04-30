import {
  progressBarCurrentId,
  progressBarThumbId,
} from "../../../ui-components/level-two/player-control-overlay/PlayerControlOverlay.types";

/**
 * Imperatively updates the progress bar DOM elements to avoid React re-renders.
 *
 * @param params.duration - Video duration in seconds.
 * @param params.progress - Current playback progress in seconds.
 */
export const updateProgressBarDOM = ({
  duration,
  progress,
}: {
  duration: number;
  progress: number;
}) => {
  if (duration === 0) {
    console.error("updateProgressBarDOM: duration is 0");
    return;
  }

  const percentage = (progress / duration) * 100;

  const progressBarCurrent = document.getElementById(progressBarCurrentId);
  if (progressBarCurrent) {
    progressBarCurrent.style.width = `${percentage}%`;
  }

  const progressBarThumb = document.getElementById(progressBarThumbId);
  if (progressBarThumb) {
    progressBarThumb.style.translate = `${percentage}cqw`;
  }
};

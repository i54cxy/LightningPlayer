import { progressBarThumbnailProgressId } from "../../../ui-components/level-two/player-control-overlay/PlayerControlOverlay.types";

/**
 * Imperatively sets the width of the preview-thumbnail fill-progress shade on
 * the progress bar, avoiding React re-renders.
 *
 * @param fraction - The fraction (0-1) of thumbnails filled so far.
 */
export const updateThumbnailProgressBarDOM = (fraction: number): void => {
  const element = document.getElementById(progressBarThumbnailProgressId);
  if (!element) {
    return;
  }

  element.style.width = `${Math.min(1, Math.max(0, fraction)) * 100}%`;
};

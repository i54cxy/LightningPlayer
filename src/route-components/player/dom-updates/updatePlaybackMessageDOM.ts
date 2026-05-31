import { playbackMessageTextId } from "../../../ui-components/base/playback-message/PlaybackMessage";

/**
 * Imperatively sets the playback message text, avoiding React re-renders.
 *
 * @param message - The message to display, or undefined to clear it.
 */
export const updatePlaybackMessageDOM = (message: string | undefined): void => {
  const element = document.getElementById(playbackMessageTextId);
  if (!element) {
    return;
  }

  element.textContent = message ?? "";
};

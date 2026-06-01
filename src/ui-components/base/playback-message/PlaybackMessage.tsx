import { FC } from "react";
import { playbackMessageContainerStyles } from "./PlaybackMessage.styles";

/** Element id for the imperative playback message text. */
export const playbackMessageTextId = "playback-message-text";

/**
 * Displays a transient message over the player canvas in the top-left corner.
 * Its text is set imperatively via `updatePlaybackMessageDOM` (rather than React
 * state) so the render loop can update the live FPS readout without re-renders.
 * The element stays mounted and is empty (invisible) when there is no message.
 */
export const PlaybackMessage: FC = () => {
  return <div css={playbackMessageContainerStyles} id={playbackMessageTextId} />;
};

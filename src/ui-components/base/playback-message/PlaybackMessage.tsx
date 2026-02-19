import { useAtomValue } from "jotai";
import { FC } from "react";
import { playbackMessageState } from "../../../shared/atoms/playbackMessageState";
import { playbackMessageContainerStyles } from "./PlaybackMessage.styles";

/**
 * Displays a transient message over the player canvas in the top-left corner.
 * Reads from `playbackMessageState`. Renders nothing when the message is
 * undefined or empty.
 */
export const PlaybackMessage: FC = () => {
  const message = useAtomValue(playbackMessageState);

  if (!message) {
    return null;
  }

  return <div css={playbackMessageContainerStyles}>{message}</div>;
};

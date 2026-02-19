import { css, Theme } from "@emotion/react";

export const playbackMessageContainerStyles = (theme: Theme) =>
  css({
    color: theme.colors.playbackMessage.color,
    fontSize: 13,
    left: 12,
    pointerEvents: "none",
    position: "absolute",
    top: 12,
  });

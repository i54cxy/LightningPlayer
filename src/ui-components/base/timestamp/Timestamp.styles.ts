import { css, Theme } from "@emotion/react";

export const timestampContainerStyles = (theme: Theme) =>
  css({
    alignItems: "center",
    background: theme.colors.playerControls.timestamp.background,
    borderRadius: 8,
    color: theme.colors.playerControls.button.color,
    cursor: "pointer",
    display: "flex",
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
    height: 36,
    justifyContent: "center",
    paddingLeft: 12,
    paddingRight: 12,
    transitionDuration: theme.motion.playerControls.button.transitionDuration,
    transitionProperty: "color",
    transitionTimingFunction:
      theme.motion.playerControls.button.transitionTimingFunction,
    userSelect: "none",
    whiteSpace: "nowrap",

    "&:hover": {
      color: theme.colors.playerControls.button.foreground,
    },
  });

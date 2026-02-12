import { css, Theme } from "@emotion/react";

export const playbackSettingsContainerStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.playbackSettings.background,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    padding: 8,
  });

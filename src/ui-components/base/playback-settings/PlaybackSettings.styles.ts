import { css, Theme } from "@emotion/react";

export const playbackSettingsContainerStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.playbackSettings.background,
    borderRadius: 12,
    minHeight: 200,
    minWidth: 250,
    padding: 8,
  });

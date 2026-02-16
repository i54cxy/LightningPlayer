import { css, Theme } from "@emotion/react";

export const selectedTextStyles = (theme: Theme) =>
  css({
    color: theme.colors.text.default,
    fontSize: 14,

    "&[data-toggled-on=true]": {
      color: theme.colors.text.selected,
    },
  });

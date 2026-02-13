import { css, Theme } from "@emotion/react";

export const itemCheckmarkStyles = (theme: Theme) =>
  css({
    alignItems: "center",
    color: theme.colors.text.selected,
    display: "flex",
    lineHeight: 0,
    marginLeft: "auto",

    "& svg": {
      height: 16,
      width: 16,
    },
  });

export const itemContainerStyles = css({
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: 8,

  cursor: "pointer",
  display: "flex",
  gap: 12,
  padding: "8px 12px",
  width: "100%",

  "&:hover": {
    background: "rgba(255, 255, 255, 0.1)",
  },
});

export const itemTextStyles = (theme: Theme) =>
  css({
    color: theme.colors.text.default,
    fontSize: 14,
    whiteSpace: "nowrap",

    "&[data-is-selected=true]": {
      color: theme.colors.text.selected,
    },
  });

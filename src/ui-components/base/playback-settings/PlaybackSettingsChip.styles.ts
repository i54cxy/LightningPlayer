import { css } from "@emotion/react";

export const chipContainerStyles = css({
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  color: "rgba(255, 255, 255, 0.9)",
  cursor: "pointer",
  display: "flex",
  gap: 12,
  padding: "8px 12px",
  width: "100%",

  "&:hover": {
    background: "rgba(255, 255, 255, 0.1)",
  },

  "&:disabled": {
    color: "rgba(255, 255, 255, 0.35)",
    cursor: "default",
    pointerEvents: "none",
  },
});

export const chipIconStyles = css({
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  lineHeight: 0,

  "& svg": {
    height: 20,
    width: 20,
  },
});

export const chipRightIconContainerStyles = css({
  alignItems: "center",
  display: "flex",
  lineHeight: 0,
  marginLeft: "auto",

  "& svg": {
    height: 16,
    width: 16,
  },
});

export const chipTextCenteredStyles = css({
  textAlign: "center",
  width: "100%",
});

export const chipTextStyles = css({
  fontSize: 14,
  whiteSpace: "nowrap",
});

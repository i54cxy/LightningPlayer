import { css } from "@emotion/react";

export const backButtonStyles = css({
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  color: "rgba(255, 255, 255, 0.9)",
  cursor: "pointer",
  display: "flex",
  gap: 8,
  padding: "8px 12px",
  width: "100%",

  "& svg": {
    height: 20,
    width: 20,
  },

  "&:hover": {
    background: "rgba(255, 255, 255, 0.1)",
  },
});

export const backButtonTextStyles = css({
  fontSize: 14,
  fontWeight: 500,
});

export const separatorStyles = css({
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  border: "none",
  height: 1,
  margin: "4px 0",
  width: "100%",
});

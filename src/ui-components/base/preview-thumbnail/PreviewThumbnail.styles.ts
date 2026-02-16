import { css, keyframes, Theme } from "@emotion/react";

export const previewThumbnailHeight = 108;
export const previewThumbnailWidth = 192;
const borderRadius = 4;

const loadingDotPulse = keyframes({
  "0%, 80%, 100%": {
    opacity: 0.3,
  },
  "40%": {
    opacity: 1,
  },
});

export const loadingOverlayStyles = css({
  alignItems: "center",
  borderRadius,
  display: "flex",
  gap: 6,
  height: previewThumbnailHeight,
  justifyContent: "center",
  left: 0,
  opacity: 0,
  pointerEvents: "none",
  position: "absolute",
  top: 0,
  transition: "opacity 150ms ease-in-out",
  width: previewThumbnailWidth,

  "&[data-loading='true']": {
    opacity: 1,
  },
});

export const loadingDotStyles = css({
  animation: `${loadingDotPulse} 1.2s ease-in-out infinite`,
  backgroundColor: "white",
  borderRadius: "50%",
  height: 8,
  width: 8,
  "&:nth-of-type(1)": {
    animationDelay: "0s",
  },
  "&:nth-of-type(2)": {
    animationDelay: "0.2s",
  },
  "&:nth-of-type(3)": {
    animationDelay: "0.4s",
  },
});

export const containerStyles = css({
  position: "relative",
});

export const tooltipStyles = (theme: Theme) =>
  css({
    background: theme.colors.playerControls.tooltip.background,
    color: theme.colors.playerControls.tooltip.color,
  });

export const thumbnailStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.previewThumbnail.background,
    border: `1px solid ${theme.colors.playerControls.previewThumbnail.border}`,
    borderRadius,
    display: "block",
    height: previewThumbnailHeight,
    objectFit: "contain",
    width: previewThumbnailWidth,
  });

export const placeholderStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.previewThumbnail.background,
    border: `1px solid ${theme.colors.playerControls.previewThumbnail.border}`,
    borderRadius,
    height: previewThumbnailHeight,
    position: "absolute",
    width: previewThumbnailWidth,

    "&[data-initialized='true']": {
      opacity: 0,
    },
  });

export const timestampStyles = (theme: Theme) =>
  css({
    backgroundColor:
      theme.colors.playerControls.previewThumbnail.timestampBackground,
    borderRadius: 8,
    color: theme.colors.playerControls.previewThumbnail.timestampColor,
    fontSize: 12,
    fontWeight: 500,
    padding: "2px 6px",
  });

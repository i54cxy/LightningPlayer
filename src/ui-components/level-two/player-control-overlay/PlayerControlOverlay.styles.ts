import { css, CSSObject, Theme } from "@emotion/react";
import {
  tooltipDefaultHeight,
  tooltipDefaultMarginTop,
} from "../../base/tooltip/Tooltip.styles";
import {
  playerControlButtonContainerHeight,
  playerControlButtonContainerMarginTop,
} from "./PlayerControlOverlay.types";

const progressBarTrackHeight = 3;
const progressBarTrackExpandedHeight = 5;
export const progressBarThumbRadius = 6;
export const progressBarThumbExpandedRadius = 8;
const progressBarContainerHeight = progressBarThumbExpandedRadius * 2;

export const playerControlOverlayContainerStyles = (theme: Theme) =>
  css({
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    left: 0,
    opacity: 0,
    position: "absolute",
    top: 0,
    transition: `opacity ${theme.motion.playerControls.overlay.transitionDuration} ${
      theme.motion.playerControls.overlay.transitionTimingFunction
    }`,
    width: "100%",
    "&[data-is-overlay-shown=true]": {
      opacity: 1,
    },

    // Hide cursor on the container when the overlay is not shown.
    "&:not([data-is-overlay-shown=true])": {
      cursor: "none",
    },
    // Hide cursor on all descendants too, overriding child cursor styles (e.g. cursor: pointer on buttons).
    "&:not([data-is-overlay-shown=true]) *": {
      cursor: "none",
    },
  });

export const topContainerStyles = css({
  cursor: "pointer",
  flex: 1,
});

export const bottomControlsContainerStyles = css({
  alignItems: "center",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  paddingLeft: 20,
  paddingRight: 20,
  width: "100%",
});

export const progressBarContainerStyles = css({
  backgroundColor: "transparent",
  containerType: "size",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  height: progressBarContainerHeight,
  justifyContent: "center",
  overflow: "visible",
  position: "relative",
  width: "100%",
});

export const progressBarCurrentStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.progressBar.thumb,
    borderRadius: progressBarTrackHeight / 2,
    height: progressBarTrackHeight,
    position: "absolute",
    transition: `transform ${theme.motion.playerControls.progressBar.transitionDuration} ${theme.motion.playerControls.progressBar.transitionTimingFunction}`,

    "[data-is-progress-bar-hovered=true] > &": {
      transform: `scaleY(${
        progressBarTrackExpandedHeight / progressBarTrackHeight
      })`,
    },
  });

export const progressbarThumbStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.progressBar.thumb,
    borderRadius: "50%",
    height: progressBarThumbRadius * 2,
    position: "absolute",
    transition: `transform ${theme.motion.playerControls.progressBar.transitionDuration} ${theme.motion.playerControls.progressBar.transitionTimingFunction}`,
    width: progressBarThumbRadius * 2,

    "[data-is-progress-bar-hovered=true] > &": {
      transform: `scale(${
        progressBarThumbExpandedRadius / progressBarThumbRadius
      })`,
    },
  });

export const progressBarTrackStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.progressBar.background,
    borderRadius: progressBarTrackHeight / 2,
    height: progressBarTrackHeight,
    position: "absolute",
    transition: `transform ${theme.motion.playerControls.progressBar.transitionDuration} ${theme.motion.playerControls.progressBar.transitionTimingFunction}`,
    width: "100%",

    "[data-is-progress-bar-hovered=true] > &": {
      transform: `scaleY(${
        progressBarTrackExpandedHeight / progressBarTrackHeight
      })`,
    },
  });

export const progressBarTrackFillStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.progressBar.hoverFill,
    borderRadius: progressBarTrackHeight / 2,
    height: progressBarTrackHeight,
    opacity: 0,
    position: "absolute",
    transition: `opacity ${theme.motion.playerControls.progressBar.transitionDuration} ${theme.motion.playerControls.progressBar.transitionTimingFunction}`,

    "[data-is-progress-bar-hovered=true] &": {
      opacity: 1,
    },
  });

export const buttonControlsContainerStyles = css({
  alignItems: "center",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  marginBottom: 12,
  marginTop: playerControlButtonContainerMarginTop,
  width: "100%",
});

export const tooltipContainerStyles = css({
  alignItems: "center",
  cursor: "pointer",
  height: "100%",
});

const buttonContainerStyles: CSSObject = {
  alignItems: "center",
  columnGap: 8,
  display: "flex",
  flexDirection: "row",
  height: playerControlButtonContainerHeight,
  position: "relative",
};

export const leftContainerStyles = css({
  ...buttonContainerStyles,
  justifyContent: "start",
  width: "100%",
});

export const centerContainerStyles = css({
  ...buttonContainerStyles,
});

export const rightContainerStyles = css({
  ...buttonContainerStyles,
  justifyContent: "end",
  width: "100%",
});

export const playButtonStyles = (theme: Theme) => [
  bottomControlsButtonStyles(theme),
  css({
    svg: {
      height: 30,
      width: 30,
    },
  }),
];

// Distance between tooltips and the progress bar.
const tooltipMarginBottom = 6;

export const previewThumbnailContainerStyles = (theme: Theme) =>
  css({
    bottom: "100%",
    marginBottom:
      tooltipMarginBottom + tooltipDefaultHeight + tooltipDefaultMarginTop,
    opacity: 0,
    pointerEvents: "none",
    position: "absolute",
    transform: "translateX(-50%)",
    transition: `opacity ${theme.motion.playerControls.progressBar.transitionDuration} ${theme.motion.playerControls.progressBar.transitionTimingFunction}`,

    "[data-is-progress-bar-hovered=true] > &": {
      opacity: 1,
    },
  });

/**
 * Tooltip styles for player controls - displays above the progress bar.
 * Horizontal positioning is handled dynamically by the Tooltip component via boundsRef.
 */
export const playerControlTooltipStyles = (theme: Theme) =>
  css({
    background: theme.colors.playerControls.tooltip.background,
    bottom: "100%",
    color: theme.colors.playerControls.tooltip.color,
    marginBottom:
      playerControlButtonContainerMarginTop +
      progressBarContainerHeight +
      tooltipMarginBottom,
    marginTop: 0,
    top: "auto",
  });

/** Positions AudioTrackSelector above the progress bar, aligned with tooltips. */
export const audioTrackSelectorPositionStyles = css({
  bottom: "100%",
  marginBottom:
    playerControlButtonContainerMarginTop +
    progressBarContainerHeight +
    tooltipMarginBottom,
  position: "absolute",
  right: 0,
});

/** Positions PlaybackSettings above the progress bar, aligned with tooltips. */
export const playbackSettingsPositionStyles = css({
  bottom: "100%",
  marginBottom:
    playerControlButtonContainerMarginTop +
    progressBarContainerHeight +
    tooltipMarginBottom,
  position: "absolute",
  right: 0,
});

export const bottomControlsButtonStyles = (theme: Theme) =>
  css({
    background: theme.colors.playerControls.button.background,
    border: "none",
    borderRadius: theme.colors.playerControls.button.borderRadius,
    cursor: "pointer",
    height: playerControlButtonContainerHeight,
    padding: 0,
    width: playerControlButtonContainerHeight,

    svg: {
      color: theme.colors.playerControls.button.color,
      height: 24,
      width: 24,
      transitionDuration: theme.motion.playerControls.button.transitionDuration,
      transitionProperty: "color, transform",
      transitionTimingFunction:
        theme.motion.playerControls.button.transitionTimingFunction,
    },

    "&:hover": {
      svg: {
        color: theme.colors.playerControls.button.foreground,
        transform: `scale(${theme.motion.playerControls.button.foregroundScale})`,
      },
    },
  });

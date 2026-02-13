import { css, Theme } from "@emotion/react";

const collapsedWidth = 24;
const iconSliderGap = 4;
const sliderHeight = 4;
export const sliderWidth = 70;
export const thumbSize = 12;
const expandedWidth = collapsedWidth + iconSliderGap + sliderWidth;

export const containerStyles = (theme: Theme) =>
  css({
    alignItems: "center",
    display: "flex",
    gap: iconSliderGap,
    height: "100%",
    transition: `width ${theme.motion.playerControls.button.transitionDuration} ${theme.motion.playerControls.button.transitionTimingFunction}`,
    width: collapsedWidth,

    "&[data-is-volume-control-expanded=true]": {
      width: expandedWidth,
    },
  });

export const tooltipContainerStyles = css({
  alignItems: "center",
  cursor: "pointer",
  height: "100%",
});

export const iconButtonStyles = (theme: Theme) =>
  css({
    background: "transparent",
    border: "none",
    color: theme.colors.playerControls.button.color,
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    transitionDuration: theme.motion.playerControls.button.transitionDuration,
    transitionProperty: "color, transform",
    transitionTimingFunction:
      theme.motion.playerControls.button.transitionTimingFunction,

    svg: {
      height: 24,
      width: 24,
    },

    "&:hover": {
      color: theme.colors.playerControls.button.foreground,
      transform: `scale(${theme.motion.playerControls.button.foregroundScale})`,
    },

    "[data-is-volume-control-expanded=true] &": {
      color: theme.colors.playerControls.button.foreground,
      transform: `scale(${theme.motion.playerControls.button.foregroundScale})`,
    },
  });

export const sliderContainerStyles = (theme: Theme) =>
  css({
    alignItems: "center",
    display: "flex",
    height: thumbSize,
    opacity: 0,
    position: "relative",
    transform: "scaleX(0)",
    transformOrigin: "left",
    transitionDuration: theme.motion.playerControls.button.transitionDuration,
    transitionProperty: "opacity, transform",
    transitionTimingFunction:
      theme.motion.playerControls.button.transitionTimingFunction,
    width: 0,

    "[data-is-volume-control-expanded=true] &": {
      opacity: 1,
      width: sliderWidth,
      transform: "scaleX(1)",
    },
  });

export const trackStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.volumeControl.background,
    borderRadius: sliderHeight / 2,
    height: sliderHeight,
    position: "absolute",
    width: "100%",
  });

export const fillStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.volumeControl.fill,
    borderRadius: sliderHeight / 2,
    height: sliderHeight,
    left: 0,
    position: "absolute",
  });

export const thumbStyles = (theme: Theme) =>
  css({
    backgroundColor: theme.colors.playerControls.volumeControl.thumb,
    borderRadius: "50%",
    height: thumbSize,
    position: "absolute",
    width: thumbSize,
  });

/**
 * Tooltip styles for VolumeControls - displays above the progress bar.
 * Offset: 8px (buttonContainer marginTop) + 16px (progressBar height) + 6px (gap) = 30px.
 * Horizontal positioning is handled dynamically by the Tooltip component via boundsRef.
 */
export const tooltipStyles = (theme: Theme) =>
  css({
    background: theme.colors.playerControls.tooltip.background,
    bottom: "100%",
    color: theme.colors.playerControls.tooltip.color,
    marginBottom: 30,
    marginTop: 0,
    top: "auto",
  });

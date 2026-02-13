import { css, Theme } from "@emotion/react";
import { ZIndex } from "../../../shared/styles/zIndex";

export const tooltipDefaultHeight = 28;
export const tooltipDefaultMarginTop = 6;

export const tooltipContainerStyles = css({
  display: "flex",
  position: "relative",
});

/**
 * Default position: bottom (below trigger), auto-flips to top via data attribute.
 */
export const tooltipStyles = (theme: Theme) =>
  css({
    alignItems: "center",
    backgroundColor: theme.colors.tooltip.background,
    borderRadius: 8,
    boxSizing: "border-box",
    color: theme.colors.tooltip.color,
    display: "flex",
    fontSize: 12,
    height: tooltipDefaultHeight,
    justifyContent: "center",
    left: "50%",
    marginTop: tooltipDefaultMarginTop,
    opacity: 0,
    padding: "6px 10px",
    pointerEvents: "none",
    position: "absolute",
    top: "100%",
    transition: "opacity 0.15s ease-in-out",
    whiteSpace: "nowrap",
    zIndex: ZIndex.TOOLTIP,

    // Show on hover.
    "[data-is-hovered=true] > &": {
      opacity: 1,
    },

    "&[data-show-tooltip=true]": {
      opacity: 1,
    },

    "&[data-show-tooltip=false]": {
      opacity: 0,
    },

    // Auto-flip to top when data-position="top".
    "&[data-tooltip-position=top]": {
      bottom: "100%",
      marginBottom: 6,
      marginTop: 0,
      top: "auto",
    },
  });

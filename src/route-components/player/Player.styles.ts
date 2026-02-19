import { css } from "@emotion/react";

export const playerControlOverlayStyles = css({
  height: "100%",
  left: 0,
  position: "absolute",
  top: 0,
  width: "100%",
});

export const audioVisualizationCanvasStyles = css({
  background: "black",
  height: "100%",
  left: 0,
  pointerEvents: "none",
  position: "absolute",
  top: 0,
  width: "100%",

  "&:not([data-visible=true])": {
    display: "none",
  },
});

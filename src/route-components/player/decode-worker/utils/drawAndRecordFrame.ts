import { WrappedCanvas } from "mediabunny";
import { IDimensions } from "../../../../shared/types/dimensions";

export interface IPlaybackDrawState {
  ctx: OffscreenCanvasRenderingContext2D;
  flipHorizontal: boolean;
  flipVertical: boolean;
  lastDrawnFrame: WrappedCanvas | undefined;
  rotation: number;
  screenDimensions: IDimensions;
}

/**
 * Draws a video frame to the offscreen canvas (centered, fit-to-screen, with
 * optional flip + rotation), and records it on `drawState.lastDrawnFrame` so
 * later transform / resize updates can re-render the same frame.
 *
 * @param params.drawState - The render target and current transform; mutated
 *   in place to update lastDrawnFrame.
 * @param params.wrappedCanvas - The decoded source frame to draw.
 */
export const drawAndRecordFrame = ({
  drawState,
  wrappedCanvas,
}: {
  drawState: IPlaybackDrawState;
  wrappedCanvas: WrappedCanvas;
}) => {
  const { ctx, flipHorizontal, flipVertical, rotation, screenDimensions } =
    drawState;
  const { canvas } = wrappedCanvas;

  // Axis-aligned bounding box of the rotated frame.
  const cosR = Math.abs(Math.cos(rotation));
  const sinR = Math.abs(Math.sin(rotation));
  const effectiveHeight = canvas.width * sinR + canvas.height * cosR;
  const effectiveWidth = canvas.width * cosR + canvas.height * sinR;

  // Scale to fit the screen while preserving aspect ratio.
  const heightScale = screenDimensions.height / effectiveHeight;
  const widthScale = screenDimensions.width / effectiveWidth;
  const scale = Math.min(widthScale, heightScale);
  const dh = canvas.height * scale;
  const dw = canvas.width * scale;

  ctx.clearRect(0, 0, screenDimensions.width, screenDimensions.height);

  ctx.save();
  // Translate to the center of the screen, flip, rotate, then draw centered.
  ctx.translate(screenDimensions.width / 2, screenDimensions.height / 2);
  ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
  ctx.rotate(rotation);
  ctx.drawImage(canvas, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  drawState.lastDrawnFrame = wrappedCanvas;
};

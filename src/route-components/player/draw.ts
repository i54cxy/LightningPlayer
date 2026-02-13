import { WrappedCanvas } from "mediabunny";
import { IDimensions } from "../../shared/types/dimensions";

/**
 * Draws the WrappedCanvas to the target canvas context, with optional flip and rotation.
 *
 * @param params.ctx - The 2D rendering context of the target canvas.
 * @param params.flipHorizontal - Whether to flip the frame horizontally.
 * @param params.flipVertical - Whether to flip the frame vertically.
 * @param params.rotation - Rotation in radians, clockwise.
 * @param params.screenDimensions - The dimensions of the target canvas.
 * @param params.wrappedCanvas - The source video frame to draw.
 */
export const draw = ({
  ctx,
  flipHorizontal,
  flipVertical,
  rotation,
  screenDimensions,
  wrappedCanvas,
}: {
  ctx: CanvasRenderingContext2D;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: number;
  screenDimensions: IDimensions;
  wrappedCanvas: WrappedCanvas;
}) => {
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
};

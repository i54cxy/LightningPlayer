import { IDimensions } from "../../shared/types/dimensions";
import { COLUMNS_PER_SECOND } from "./computeWaveformOverview";

/**
 * Draws a windowed waveform overview onto the canvas.
 *
 * The visible time window spans `windowSec` seconds, always centred on
 * `currentTime`, so the playhead is fixed at the horizontal midpoint and
 * the waveform scrolls beneath it. Empty space is shown for the portions
 * of the window that fall outside the file (before 0 s or after duration).
 *
 * While `waveformData` is undefined (still computing), a thin centre line is
 * drawn so the visualization mode remains visually acknowledged.
 *
 * Clears the canvas before drawing, so the CSS background color is revealed.
 *
 * @param params.ctx - The 2D rendering context of the visualization canvas.
 * @param params.currentTime - Current playback position in seconds.
 * @param params.screenDimensions - The dimensions of the visualization canvas.
 * @param params.waveformData - Precomputed peak amplitudes (0–1 per column),
 *   or undefined while the background computation is still running.
 * @param params.windowSec - Width of the visible time window in seconds.
 */
export const drawWaveformOverview = ({
  ctx,
  currentTime,
  screenDimensions,
  waveformData,
  windowSec,
}: {
  ctx: CanvasRenderingContext2D;
  currentTime: number;
  screenDimensions: IDimensions;
  waveformData: Float32Array | undefined;
  windowSec: number;
}) => {
  const { height, width } = screenDimensions;
  ctx.clearRect(0, 0, width, height);

  const centerY = height / 2;

  if (!waveformData) {
    // Loading state: thin centre line until data arrives.
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(0, centerY - 1, width, 2);
  } else {
    // Each column spans 1/COLUMNS_PER_SECOND seconds.
    // Only iterate the columns that fall within the visible window.
    const windowStart = currentTime - windowSec / 2;
    const windowEnd = currentTime + windowSec / 2;
    const firstCol = Math.max(0, Math.floor(windowStart * COLUMNS_PER_SECOND));
    const lastCol = Math.min(
      waveformData.length - 1,
      Math.ceil(windowEnd * COLUMNS_PER_SECOND),
    );

    // Width of one column in pixels.
    const columnWidthPx = width / (windowSec * COLUMNS_PER_SECOND);

    // Vertical gradient: red at the top and bottom edges (peak amplitude),
    // white at the centre line (silence) — matching the real-time waveform.
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(239, 68, 68, 0.9)"); // red-500   (top)
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.9)"); // white     (centre)
    gradient.addColorStop(1, "rgba(239, 68, 68, 0.9)"); // red-500   (bottom)
    ctx.fillStyle = gradient;

    for (let col = firstCol; col <= lastCol; col++) {
      const colTime = col / COLUMNS_PER_SECOND;
      // Map colTime to an x position, with currentTime pinned to width / 2.
      const x = ((colTime - currentTime) / windowSec) * width + width / 2;
      const peak = waveformData[col];
      if (peak === undefined) {
        continue;
      }
      // Cap at 80% of half-height so bars never touch the top/bottom edge
      // (leaves 10% padding on each side).
      const barHalfHeight = Math.max(1, peak * centerY * 0.8);
      ctx.fillRect(
        x,
        centerY - barHalfHeight,
        Math.max(1, columnWidthPx),
        barHalfHeight * 2,
      );
    }
  }

  // Playhead: always at the horizontal centre of the canvas.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, height * 0.1);
  ctx.lineTo(width / 2, height * 0.9);
  ctx.stroke();
};

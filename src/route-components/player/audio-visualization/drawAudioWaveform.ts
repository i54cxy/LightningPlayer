import { IDimensions } from "../../../shared/types/dimensions";

/**
 * Draws an oscilloscope-style waveform visualization onto the canvas.
 * A vertical gradient colours the stroke by amplitude displacement: blue at
 * the centre line (silence) transitioning to red at the top and bottom edges
 * (peak amplitude), symmetrically for both positive and negative excursions.
 *
 * Clears the canvas before drawing, so the CSS background color is revealed.
 *
 * @param params.analyserNode - The Web Audio AnalyserNode to read time-domain data from.
 * @param params.ctx - The 2D rendering context of the waveform canvas.
 * @param params.screenDimensions - The dimensions of the waveform canvas.
 */
export const drawAudioWaveform = ({
  analyserNode,
  ctx,
  screenDimensions,
}: {
  analyserNode: AnalyserNode;
  ctx: CanvasRenderingContext2D;
  screenDimensions: IDimensions;
}) => {
  const { height, width } = screenDimensions;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteTimeDomainData(dataArray);

  ctx.clearRect(0, 0, width, height);

  // Vertical gradient symmetric around the centre: red at the edges (peak
  // amplitude) and blue at the midpoint (silence / zero crossing).
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(239, 68, 68, 0.9)"); // red-500   (top peak)
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.9)"); // blue-400  (centre)
  gradient.addColorStop(1, "rgba(239, 68, 68, 0.9)"); // red-500   (bottom peak)

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = gradient;

  const sliceWidth = width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    // dataArray values range from 0 to 255; 128 is the centre (silence).
    const v = dataArray[i]! / 128.0;
    const y = (v * height) / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.lineTo(width, height / 2);
  ctx.stroke();
};

import { IDimensions } from "../../../shared/types/dimensions";

/** Number of frequency bars to render. */
const BAR_COUNT = 80;

/** Pixel gap between adjacent bars. */
const BAR_GAP = 2;

/** Minimum rendered bar height in pixels, so bars are always visible. */
const MIN_BAR_HEIGHT = 2;

/** Lowest frequency (Hz) mapped to the first bar on the log scale. */
const MIN_FREQ_HZ = 20;

/** Fraction of the canvas height that the tallest possible bar may occupy. */
const MAX_BAR_HEIGHT_FRACTION = 0.9;

/**
 * Draws a frequency-bar visualization onto the canvas using logarithmically
 * spaced frequency bins. Each bar represents a frequency band whose width
 * grows exponentially from left (bass) to right (treble), matching human
 * pitch perception. Bar height encodes magnitude and is capped at 90% of the
 * canvas height. A blue→violet→orange gradient encodes relative amplitude.
 *
 * Clears the canvas before drawing, so the CSS background color is revealed.
 *
 * @param params.analyserNode - The Web Audio AnalyserNode to read frequency data from.
 * @param params.ctx - The 2D rendering context of the visualization canvas.
 * @param params.screenDimensions - The dimensions of the visualization canvas.
 */
export const drawAudioFrequencyBars = ({
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
  analyserNode.getByteFrequencyData(dataArray);

  ctx.clearRect(0, 0, width, height);

  // A single gradient spanning the full canvas height is shared by every bar.
  // fillRect clips to each bar's bounds so taller bars reveal more of the warm
  // top portion of the gradient.
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, "rgba(96, 165, 250, 0.9)"); // blue-400  (quiet)
  gradient.addColorStop(0.5, "rgba(167, 139, 250, 0.9)"); // violet-400 (mids)
  gradient.addColorStop(1, "rgba(251, 92, 60, 0.9)"); // orange-400 (loud)
  ctx.fillStyle = gradient;

  const nyquist = analyserNode.context.sampleRate / 2;
  const logMin = Math.log10(MIN_FREQ_HZ);
  const logMax = Math.log10(nyquist);
  const barWidth = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
  const maxBarHeight = height * MAX_BAR_HEIGHT_FRACTION;

  for (let i = 0; i < BAR_COUNT; i++) {
    // Map bar index to a frequency range on a logarithmic scale.
    const freqStart = Math.pow(
      10,
      logMin + (i / BAR_COUNT) * (logMax - logMin),
    );
    const freqEnd = Math.pow(
      10,
      logMin + ((i + 1) / BAR_COUNT) * (logMax - logMin),
    );

    // Convert frequencies to FFT bin indices.
    const binStart = Math.max(
      0,
      Math.floor((freqStart / nyquist) * bufferLength),
    );
    const binEnd = Math.min(
      bufferLength - 1,
      Math.ceil((freqEnd / nyquist) * bufferLength),
    );

    // Average the magnitudes of all bins in this frequency range.
    let sum = 0;
    const binCount = Math.max(1, binEnd - binStart + 1);
    for (let b = binStart; b <= binEnd; b++) {
      sum += dataArray[b]!;
    }
    const amplitude = sum / binCount / 255; // 0–1

    const barHeight = Math.max(MIN_BAR_HEIGHT, amplitude * maxBarHeight);
    const x = i * (barWidth + BAR_GAP);
    const y = height - barHeight;

    ctx.fillRect(x, y, barWidth, barHeight);
  }
};

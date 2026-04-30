/**
 * Computes the time window captured by an AnalyserNode in milliseconds.
 * The window size is determined by `fftSize / sampleRate`.
 *
 * @param analyserNode - The AnalyserNode to compute the window for.
 * @returns The time window duration in milliseconds, rounded to the nearest integer.
 */
export const computeAnalyserWindowMs = (analyserNode: AnalyserNode): number =>
  Math.round((analyserNode.fftSize / analyserNode.context.sampleRate) * 1000);

import { DecodeWorkerManager } from "../decode-worker/DecodeWorkerManager";

const AVERAGE_FRAME_THRESHOLD_MS = 250;
const SAMPLE_RATIOS = [0.1, 0.33, 0.66, 0.9];
const SINGLE_FRAME_THRESHOLD_MS = 1000;

/**
 * Decodes a few sample frames in the worker to decide whether the file is
 * fast enough to support preview thumbnails during seeking.
 *
 * Two conditions must be met:
 * 1. No single frame decode exceeds `SINGLE_FRAME_THRESHOLD_MS` (1s).
 * 2. The average decode time across all samples is under
 *    `AVERAGE_FRAME_THRESHOLD_MS` (250ms).
 *
 * Returns false as soon as any single decode exceeds the per-frame threshold
 * so the main thread is never blocked by a runaway decode. The manager handles
 * its own worker recovery on probe timeout.
 *
 * @param params.decodeWorkerManager - An already-initialized DecodeWorkerManager.
 * @param params.duration - Total duration of the video in seconds.
 * @param params.isCancelled - Returns true if the caller (the file-load effect) has been cancelled.
 * @returns True if preview thumbnails should be enabled; false if cancelled, slow, or errored.
 */
export const getIsPreviewThumbnailEnabled = async ({
  decodeWorkerManager,
  duration,
  isCancelled,
}: {
  decodeWorkerManager: DecodeWorkerManager;
  duration: number;
  isCancelled: () => boolean;
}): Promise<boolean> => {
  const sampleTimestamps = [
    ...new Set(SAMPLE_RATIOS.map((ratio) => ratio * duration)),
  ];

  const samples: number[] = [];

  try {
    for (const timestamp of sampleTimestamps) {
      if (isCancelled()) return false;

      const result = await decodeWorkerManager.probe({
        timeoutMs: SINGLE_FRAME_THRESHOLD_MS,
        timestamp,
      });
      if (isCancelled()) return false;
      if (result.aborted) {
        console.warn(
          `getIsPreviewThumbnailEnabled: single frame at ${timestamp.toFixed(2)}s exceeded ${SINGLE_FRAME_THRESHOLD_MS}ms. Samples:`,
          samples,
        );
        return false;
      }
      samples.push(result.durationMs);
    }

    const averageMs =
      samples.length > 0
        ? samples.reduce((sum, s) => sum + s, 0) / samples.length
        : 0;

    if (averageMs > AVERAGE_FRAME_THRESHOLD_MS) {
      console.warn(
        `getIsPreviewThumbnailEnabled: average decode time ${averageMs.toFixed(1)}ms exceeds ${AVERAGE_FRAME_THRESHOLD_MS}ms. Samples:`,
        samples,
      );
      return false;
    }

    console.log(
      `getIsPreviewThumbnailEnabled: passed (avg ${averageMs.toFixed(1)}ms). Samples:`,
      samples,
    );
    return true;
  } catch (error) {
    console.warn("getIsPreviewThumbnailEnabled: error during probe.", error);
    return false;
  }
};

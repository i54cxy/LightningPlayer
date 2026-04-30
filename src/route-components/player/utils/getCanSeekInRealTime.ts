import { DecodeWorkerManager } from "../decode-worker/DecodeWorkerManager";

const SAMPLE_RATIOS = [0.1, 0.33, 0.66, 0.9];
const SINGLE_FRAME_THRESHOLD_MS = 1000;

/**
 * Decodes a few sample frames in the worker to decide whether the file is
 * fast enough to support real-time seeking (used to gate preview thumbnails).
 *
 * Returns false as soon as any single decode exceeds
 * `SINGLE_FRAME_THRESHOLD_MS` so the main thread is never blocked by a runaway
 * decode. The manager handles its own worker recovery on probe timeout.
 *
 * @param params.decodeWorkerManager - An already-initialized DecodeWorkerManager.
 * @param params.duration - Total duration of the video in seconds.
 * @param params.isCancelled - Returns true if the caller (the file-load effect) has been cancelled.
 * @returns True if every sample frame decoded within the threshold; false if cancelled, slow, or errored.
 */
export const getCanSeekInRealTime = async ({
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
    for (let i = 0; i < sampleTimestamps.length; i++) {
      if (isCancelled()) return false;
      const timestamp = sampleTimestamps[i];
      if (timestamp === undefined) continue;

      const result = await decodeWorkerManager.probe({
        timeoutMs: SINGLE_FRAME_THRESHOLD_MS,
        timestamp,
      });
      if (isCancelled()) return false;
      if (result.aborted) {
        console.warn(
          `getCanSeekInRealTime: single frame at ${timestamp.toFixed(2)}s exceeded ${SINGLE_FRAME_THRESHOLD_MS}ms. Samples:`,
          samples,
        );
        return false;
      }
      if (result.durationMs !== undefined) {
        samples[i] = result.durationMs;
      }
    }

    console.log("getCanSeekInRealTime: passed. Samples:", samples);
    return true;
  } catch (error) {
    console.warn("getCanSeekInRealTime: error during probe.", error);
    return false;
  }
};

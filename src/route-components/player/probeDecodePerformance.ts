import { DecodeWorkerManager } from "./decode-worker/DecodeWorkerManager";

const SAMPLE_RATIOS = [0.1, 0.33, 0.66, 0.9];
const SINGLE_FRAME_THRESHOLD_MS = 1000;

/**
 * Probes decoding performance of a video file by decoding sample frames in a
 * Web Worker and timing each. Aborts (terminates the worker) as soon as any
 * single decode exceeds `SINGLE_FRAME_THRESHOLD_MS` so the main thread is
 * never blocked by a runaway decode.
 *
 * @param params.blob - The video file to probe.
 * @param params.duration - Total duration of the video in seconds.
 * @param params.isCancelled - Returns true if the caller (the file-load effect) has been cancelled.
 * @param params.videoTrackIndex - Index of the video track in the file's all-tracks list.
 * @returns True if every sample frame decoded within the threshold; false if cancelled, slow, or errored.
 */
export const probeDecodePerformance = async ({
  blob,
  duration,
  isCancelled,
  videoTrackIndex,
}: {
  blob: Blob;
  duration: number;
  isCancelled: () => boolean;
  videoTrackIndex: number;
}): Promise<boolean> => {
  const sampleTimestamps = [
    ...new Set(SAMPLE_RATIOS.map((ratio) => ratio * duration)),
  ];

  const manager = new DecodeWorkerManager();
  const samples: number[] = [];

  try {
    await manager.initialize({ blob, videoTrackIndex });

    for (let i = 0; i < sampleTimestamps.length; i++) {
      if (isCancelled()) return false;
      const timestamp = sampleTimestamps[i];
      if (timestamp === undefined) continue;

      const result = await manager.probe({
        timeoutMs: SINGLE_FRAME_THRESHOLD_MS,
        timestamp,
      });
      if (isCancelled()) return false;
      if (result.aborted) {
        console.warn(
          `probeDecodePerformance: single frame at ${timestamp.toFixed(2)}s exceeded ${SINGLE_FRAME_THRESHOLD_MS}ms. Samples:`,
          samples,
        );
        return false;
      }
      if (result.durationMs !== undefined) {
        samples[i] = result.durationMs;
      }
    }

    console.log("probeDecodePerformance: passed. Samples:", samples);
    return true;
  } catch (error) {
    console.warn("probeDecodePerformance: error during probe.", error);
    return false;
  } finally {
    manager.dispose();
  }
};

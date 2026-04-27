import {
  DecodeWorkerEvent,
  DecodeWorkerEventType,
  DecodeWorkerRequestType,
} from "./decodeWorker.types";

export interface IProbeFrameResult {
  /**
   * True if the per-request timeout fired before the worker finished the
   * single-frame decode. The worker has been terminated; further calls
   * (other than `dispose`) will throw.
   */
  aborted: boolean;
  /**
   * Wall-clock decode duration in milliseconds. Set only when `aborted` is
   * false.
   */
  durationMs?: number;
}

/**
 * Main-thread wrapper around the decode worker. Owns the worker lifecycle.
 *
 * Lifecycle: `initialize` opens the file in the worker and constructs a
 * CanvasSink for the chosen video track (no timeout — header parsing is
 * always fast). Subsequent `probe` calls decode one frame and report the
 * wall-clock duration; each probe has its own timeout, and if the timer
 * fires the worker is terminated. Callers should always call `dispose`
 * (e.g. in a finally block).
 *
 * On this branch, only `initialize` and `probe` are implemented. Future
 * operations (`getThumbnail`, `getPlaybackFrame`) will add new methods that
 * reuse the same initialized worker.
 */
export class DecodeWorkerManager {
  private worker: Worker | undefined;

  /**
   * Spawns the worker and asks it to open the file and construct a CanvasSink.
   * Throws if the worker reports an Init error or emits onerror.
   *
   * @param params.blob - The file to open.
   * @param params.videoTrackIndex - Index of the video track in the file's all-tracks list.
   */
  async initialize({
    blob,
    videoTrackIndex,
  }: {
    blob: Blob;
    videoTrackIndex: number;
  }): Promise<void> {
    if (this.worker) {
      throw new Error("DecodeWorkerManager: already initialized.");
    }
    const worker = new Worker(
      new URL("./decodeWorker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;

    try {
      await new Promise<void>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<DecodeWorkerEvent>) => {
          const message = event.data;
          if (message.type === DecodeWorkerEventType.InitComplete) {
            resolve();
          } else if (message.type === DecodeWorkerEventType.InitError) {
            reject(message.error);
          } else {
            reject(
              new Error(`Unexpected event during init: ${message.type}`),
            );
          }
        };
        worker.postMessage({
          blob,
          type: DecodeWorkerRequestType.Init,
          videoTrackIndex,
        });
      });
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /**
   * Asks the (already-initialized) worker to decode one frame at the given
   * timestamp. If the decode takes longer than `timeoutMs`, the worker is
   * terminated and `aborted: true` is returned.
   *
   * @param params.timeoutMs - Per-request timeout.
   * @param params.timestamp - Timestamp in seconds of the frame to decode.
   * @returns The decode duration, or aborted=true if the timeout fired.
   */
  async probe({
    timeoutMs,
    timestamp,
  }: {
    timeoutMs: number;
    timestamp: number;
  }): Promise<IProbeFrameResult> {
    const worker = this.worker;
    if (!worker) {
      throw new Error("DecodeWorkerManager: not initialized.");
    }

    let result: IProbeFrameResult;
    try {
      result = await new Promise<IProbeFrameResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({ aborted: true });
        }, timeoutMs);
        worker.onmessage = (event: MessageEvent<DecodeWorkerEvent>) => {
          clearTimeout(timer);
          const message = event.data;
          if (message.type === DecodeWorkerEventType.ProbeResult) {
            resolve({ aborted: false, durationMs: message.durationMs });
          } else if (message.type === DecodeWorkerEventType.ProbeError) {
            reject(message.error);
          } else {
            reject(
              new Error(`Unexpected event during probe: ${message.type}`),
            );
          }
        };
        worker.postMessage({
          timestamp,
          type: DecodeWorkerRequestType.Probe,
        });
      });
    } catch (error) {
      this.dispose();
      throw error;
    }

    if (result.aborted) {
      // Worker is stuck on this frame; terminate so subsequent calls don't
      // queue up behind a runaway decode.
      this.dispose();
    }
    return result;
  }

  /**
   * Terminates the worker if it is alive. Safe to call multiple times.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }
}

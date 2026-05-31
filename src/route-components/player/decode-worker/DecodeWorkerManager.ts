import {
  DecodeWorkerEvent,
  DecodeWorkerEventType,
  DecodeWorkerRequestType,
  IPlaybackDrawParams,
} from "./decodeWorker.types";
import {
  ILoadFileParams,
  IProbeFrameResult,
} from "./DecodeWorkerManager.types";

/**
 * Main-thread wrapper around the decode worker. Owns the worker lifecycle.
 *
 * Construct once per Player mount; `dispose()` on unmount. The manager owns the
 * worker lifecycle and recycles it via `terminateWorker()`: call that when
 * switching files to instantly stop the old file's in-flight decode and spin up
 * a fresh worker. Because the offscreen canvas transferred in `startPlayback`
 * cannot be re-transferred, the new worker is paired with a fresh `<canvas>`
 * element each time. A probe timeout uses the same `terminateWorker()` path to
 * recover a hung worker, then re-loads the same file.
 */
export class DecodeWorkerManager {
  // Latest on-screen frame rate reported by the worker during playback (frames
  // drawn per second). Read by the render loop for the FPS readout; 0 when
  // paused or between files.
  decodedFps = 0;
  // Set by dispose(); guards the probe-timeout respawn so a probe that times
  // out after disposal cannot resurrect a worker from a dead manager.
  private disposed = false;
  private hasTransferredCanvas = false;
  private lastLoadFileParams: ILoadFileParams | undefined;
  private nextThumbnailRequestId = 0;
  private pendingThumbnails = new Map<
    number,
    { reject: (reason: Error) => void; resolve: (blob: Blob) => void }
  >();
  private worker: Worker;

  constructor() {
    this.worker = this.spawnWorker();
  }

  /**
   * Decodes a single frame at the given timestamp in the worker, resizes it
   * to thumbnail dimensions, and returns a JPEG blob. Concurrent requests are
   * correlated by `requestId`.
   *
   * @param timestamp - The timestamp in seconds.
   * @returns A JPEG blob of the thumbnail.
   */
  getThumbnail(timestamp: number): Promise<Blob> {
    const requestId = this.nextThumbnailRequestId++;
    return new Promise<Blob>((resolve, reject) => {
      this.pendingThumbnails.set(requestId, { reject, resolve });
      this.worker.postMessage({
        requestId,
        timestamp,
        type: DecodeWorkerRequestType.GetThumbnail,
      });
    });
  }

  /**
   * Opens the file in the worker and constructs the `videoSink` and
   * `thumbnailSink`. Resolves once both sinks are ready. Throws if the
   * worker reports an error.
   */
  async loadFile(params: ILoadFileParams): Promise<void> {
    this.lastLoadFileParams = params;
    await new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent<DecodeWorkerEvent>) => {
        const message = event.data;
        if (message.type === DecodeWorkerEventType.LoadFileComplete) {
          this.worker.removeEventListener("message", handler);
          resolve();
        } else if (message.type === DecodeWorkerEventType.LoadFileError) {
          this.worker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.worker.addEventListener("message", handler);
      this.worker.postMessage({
        blob: params.blob,
        type: DecodeWorkerRequestType.LoadFile,
        videoTrackIndex: params.videoTrackIndex,
      });
    });
  }

  /**
   * Decodes one frame at the given timestamp. If the decode exceeds
   * `timeoutMs`, the hung worker is recycled via `terminateWorker()`, the file
   * is re-loaded into the fresh worker, and `aborted: true` is returned.
   */
  async probe({
    timeoutMs,
    timestamp,
  }: {
    timeoutMs: number;
    timestamp: number;
  }): Promise<IProbeFrameResult> {
    const result = await new Promise<IProbeFrameResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.worker.removeEventListener("message", handler);
        resolve({ aborted: true });
      }, timeoutMs);
      const handler = (event: MessageEvent<DecodeWorkerEvent>) => {
        const message = event.data;
        if (message.type === DecodeWorkerEventType.ProbeResult) {
          clearTimeout(timer);
          this.worker.removeEventListener("message", handler);
          resolve({ aborted: false, durationMs: message.durationMs });
        } else if (message.type === DecodeWorkerEventType.ProbeError) {
          clearTimeout(timer);
          this.worker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.worker.addEventListener("message", handler);
      this.worker.postMessage({
        timestamp,
        type: DecodeWorkerRequestType.Probe,
      });
    });

    // On timeout, kill the stuck worker and spin up a fresh one re-loaded to
    // the same file. This is safe as long as the canvas has not been
    // transferred yet (i.e. startPlayback hasn't been called). If it has,
    // the new worker will lack the OffscreenCanvas and video rendering will
    // no-op until the Player is remounted.
    if (result.aborted && this.lastLoadFileParams && !this.disposed) {
      this.terminateWorker();
      await this.loadFile(this.lastLoadFileParams);
    }
    return result;
  }

  /**
   * First call only: transfers control of the canvas to the worker, sets
   * initial draw params. Subsequent calls are a no-op (the offscreen canvas
   * cannot be re-transferred). Throws if the worker reports an error.
   */
  async startPlayback({
    canvasElement,
    drawParams,
  }: {
    canvasElement: HTMLCanvasElement;
    drawParams: IPlaybackDrawParams;
  }): Promise<void> {
    if (this.hasTransferredCanvas) return;
    const offscreenCanvas = canvasElement.transferControlToOffscreen();
    this.hasTransferredCanvas = true;
    await new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent<DecodeWorkerEvent>) => {
        const message = event.data;
        if (message.type === DecodeWorkerEventType.StartPlaybackComplete) {
          this.worker.removeEventListener("message", handler);
          resolve();
        } else if (message.type === DecodeWorkerEventType.StartPlaybackError) {
          this.worker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.worker.addEventListener("message", handler);
      this.worker.postMessage(
        {
          drawParams,
          offscreenCanvas,
          type: DecodeWorkerRequestType.StartPlayback,
        },
        [offscreenCanvas],
      );
    });
  }

  seek(time: number): void {
    this.worker.postMessage({ time, type: DecodeWorkerRequestType.Seek });
  }

  setPlaying(isPlaying: boolean): void {
    // No frames are drawn while paused, so the worker stops reporting; clear the
    // stale rate immediately.
    if (!isPlaying) {
      this.decodedFps = 0;
    }
    this.worker.postMessage({
      isPlaying,
      type: DecodeWorkerRequestType.SetPlaying,
    });
  }

  tick(currentTime: number): void {
    this.worker.postMessage({
      currentTime,
      type: DecodeWorkerRequestType.Tick,
    });
  }

  updateDrawParams(partial: Partial<IPlaybackDrawParams>): void {
    this.worker.postMessage({
      partial,
      type: DecodeWorkerRequestType.UpdateDrawParams,
    });
  }

  /**
   * Recycles the worker: terminates the current one — instantly stopping any
   * in-flight decode on its thread — and spawns a fresh, idle replacement with
   * no file loaded and no canvas transferred. The single place workers are
   * replaced; call it when switching files and to recover a hung worker.
   */
  terminateWorker(): void {
    if (this.disposed) return;
    this.decodedFps = 0;
    this.rejectAllPendingThumbnails("Worker terminated.");
    this.worker.terminate();
    this.worker = this.spawnWorker();
    this.hasTransferredCanvas = false;
  }

  /** Terminates the worker. The manager is unusable after this. */
  dispose(): void {
    this.disposed = true;
    this.rejectAllPendingThumbnails("Worker disposed.");
    this.worker.terminate();
  }

  private rejectAllPendingThumbnails(reason: string): void {
    for (const [id, { reject }] of this.pendingThumbnails) {
      reject(new Error(reason));
      this.pendingThumbnails.delete(id);
    }
  }

  private spawnWorker(): Worker {
    const worker = new Worker(
      new URL("./decodeWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<DecodeWorkerEvent>) => {
      const message = event.data;
      if (message.type === DecodeWorkerEventType.DecodedFrameRate) {
        this.decodedFps = message.fps;
      } else if (message.type === DecodeWorkerEventType.DecodeError) {
        console.error("DecodeWorkerManager: worker decode error:", message.error);
      } else if (message.type === DecodeWorkerEventType.GetThumbnailResult) {
        const pending = this.pendingThumbnails.get(message.requestId);
        if (pending) {
          this.pendingThumbnails.delete(message.requestId);
          pending.resolve(message.blob);
        }
      } else if (message.type === DecodeWorkerEventType.GetThumbnailError) {
        const pending = this.pendingThumbnails.get(message.requestId);
        if (pending) {
          this.pendingThumbnails.delete(message.requestId);
          pending.reject(message.error);
        }
      }
    };
    return worker;
  }
}

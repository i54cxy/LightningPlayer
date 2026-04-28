import {
  DecodeWorkerEvent,
  DecodeWorkerEventType,
  DecodeWorkerRequestType,
  IPlaybackDrawParams,
} from "./decodeWorker.types";
import {
  IDecodeWorkerManagerCallbacks,
  ILoadFileParams,
  IProbeFrameResult,
} from "./DecodeWorkerManager.types";

/**
 * Main-thread wrapper around the decode worker. Owns the worker lifecycle.
 *
 * Construct once per Player mount. Call `loadFile` per file. The same worker
 * is reused across files so its offscreen canvas — transferred on the first
 * `startPlayback` — survives. On a probe timeout the manager terminates the
 * hung worker and transparently spins up a fresh one re-loaded to the same
 * file.
 */
export class DecodeWorkerManager {
  private callbacks: IDecodeWorkerManagerCallbacks = {};
  private hasTransferredCanvas = false;
  private lastLoadFileParams: ILoadFileParams | undefined;
  private worker: Worker;

  constructor() {
    this.worker = this.spawnWorker();
  }

  setCallbacks(callbacks: IDecodeWorkerManagerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Opens the file in the worker and constructs the shared `videoSink`.
   * Resolves once the sink is ready. Throws if the worker reports an error.
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
   * `timeoutMs`, the hung worker is terminated. The manager then transparently
   * spins up a fresh worker, re-loads the same file, and returns
   * `aborted: true`.
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

    if (result.aborted && this.lastLoadFileParams) {
      this.worker.terminate();
      this.worker = this.spawnWorker();
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

  reset(): void {
    this.worker.postMessage({ type: DecodeWorkerRequestType.Reset });
  }

  /** Terminates the worker. The manager is unusable after this. */
  dispose(): void {
    this.worker.terminate();
    this.callbacks = {};
  }

  private spawnWorker(): Worker {
    const worker = new Worker(
      new URL("./decodeWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<DecodeWorkerEvent>) => {
      const message = event.data;
      if (message.type === DecodeWorkerEventType.EndOfStream) {
        this.callbacks.onEndOfStream?.();
      } else if (message.type === DecodeWorkerEventType.DecodeError) {
        this.callbacks.onDecodeError?.(message.error);
      }
    };
    return worker;
  }
}

import {
  previewThumbnailHeight,
  previewThumbnailWidth,
} from "../../../ui-components/base/preview-thumbnail/PreviewThumbnail.types";
import {
  IPlaybackDrawParams,
  PlaybackWorkerEvent,
  PlaybackWorkerEventType,
  PlaybackWorkerRequestType,
} from "../playback-worker/playbackWorker.types";
import { PreviewThumbnailCache } from "../preview-thumbnail/PreviewThumbnailCache";
import {
  ThumbnailWorkerEvent,
  ThumbnailWorkerEventType,
  ThumbnailWorkerRequestType,
} from "../thumbnail-worker/thumbnailWorker.types";
import { ILoadFileParams } from "./DecodeWorkerManager.types";

/**
 * Main-thread wrapper that owns two decode workers:
 *
 * - A **playback worker** handles the streaming playback session.
 * - A **thumbnail worker** decodes all preview thumbnails.
 *
 * Decoupling them keeps thumbnail decoding off the playback thread, so it can
 * never starve frame rendering. Construct once per Player mount; `dispose()` on
 * unmount. The workers are recycled independently: `recyclePlaybackWorker()` on
 * file switch (paired with a fresh `<canvas>`, since the offscreen canvas
 * transferred in `startPlayback` cannot be re-transferred) and
 * `recycleThumbnailWorker()` on file switch and when disabling preview
 * thumbnails.
 */
export class DecodeWorkerManager {
  // Latest on-screen frame rate reported by the playback worker (frames drawn
  // per second). Read by the render loop for the FPS readout; 0 when paused or
  // between files.
  decodedFps = 0;
  // Set by dispose(); guards the probe-timeout recycle so a probe that times out
  // after disposal cannot resurrect a worker from a dead manager.
  private disposed = false;
  private hasTransferredCanvas = false;
  private playbackWorker: Worker;
  private thumbnailWorker: Worker;

  constructor() {
    this.playbackWorker = this.spawnPlaybackWorker();
    this.thumbnailWorker = this.spawnThumbnailWorker();
  }

  /**
   * First call only: transfers control of the canvas to the playback worker and
   * sets initial draw params. Subsequent calls are a no-op (the offscreen canvas
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
      const handler = (event: MessageEvent<PlaybackWorkerEvent>) => {
        const message = event.data;
        if (message.type === PlaybackWorkerEventType.StartPlaybackComplete) {
          this.playbackWorker.removeEventListener("message", handler);
          resolve();
        } else if (
          message.type === PlaybackWorkerEventType.StartPlaybackError
        ) {
          this.playbackWorker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.playbackWorker.addEventListener("message", handler);
      this.playbackWorker.postMessage(
        {
          drawParams,
          offscreenCanvas,
          type: PlaybackWorkerRequestType.StartPlayback,
        },
        [offscreenCanvas],
      );
    });
  }

  seek(time: number): void {
    this.playbackWorker.postMessage({
      time,
      type: PlaybackWorkerRequestType.Seek,
    });
  }

  setPlaying(isPlaying: boolean): void {
    // No frames are drawn while paused, so the worker stops reporting; clear the
    // stale rate immediately.
    if (!isPlaying) {
      this.decodedFps = 0;
    }
    this.playbackWorker.postMessage({
      isPlaying,
      type: PlaybackWorkerRequestType.SetPlaying,
    });
  }

  tick(currentTime: number): void {
    this.playbackWorker.postMessage({
      currentTime,
      type: PlaybackWorkerRequestType.Tick,
    });
  }

  updateDrawParams(partial: Partial<IPlaybackDrawParams>): void {
    this.playbackWorker.postMessage({
      partial,
      type: PlaybackWorkerRequestType.UpdateDrawParams,
    });
  }

  /**
   * Decodes one thumbnail per second of the file on the thumbnail worker (in one
   * sequential pass) and stores each in `cache`. Logs the estimated memory cost
   * up front and reports progress as it fills.
   *
   * @param params.cache - The cache to populate.
   * @param params.duration - Total file duration in seconds.
   * @param params.onProgress - Called as thumbnails arrive with the fraction (0-1) filled.
   */
  async fillThumbnails({
    cache,
    duration,
    onProgress,
  }: {
    cache: PreviewThumbnailCache;
    duration: number;
    onProgress?: (fraction: number) => void;
  }): Promise<void> {
    // One thumbnail per second (see handleFillThumbnails).
    const expected = Math.floor(duration) + 1;
    const estimatedMb =
      (expected * previewThumbnailWidth * previewThumbnailHeight * 4) /
      1024 /
      1024;
    console.log(
      `DecodeWorkerManager: filling ${expected} thumbnails (estimated up to ${estimatedMb.toFixed(1)} MB)`,
    );

    await new Promise<void>((resolve, reject) => {
      let received = 0;
      const handler = (event: MessageEvent<ThumbnailWorkerEvent>) => {
        const message = event.data;
        if (message.type === ThumbnailWorkerEventType.ThumbnailReady) {
          cache.set(message.timestamp, message.imageBitmap);
          received += 1;
          onProgress?.(received / expected);
          if (received % 100 === 0) {
            console.log(
              `DecodeWorkerManager: thumbnails ${received}/${expected} (${(cache.memoryBytes / 1024 / 1024).toFixed(1)} MB)`,
            );
          }
        } else if (
          message.type === ThumbnailWorkerEventType.FillThumbnailsComplete
        ) {
          this.thumbnailWorker.removeEventListener("message", handler);
          console.log(
            `DecodeWorkerManager: thumbnail fill complete — ${cache.size} thumbnails, ${(cache.memoryBytes / 1024 / 1024).toFixed(1)} MB`,
          );
          resolve();
        } else if (
          message.type === ThumbnailWorkerEventType.FillThumbnailsError
        ) {
          this.thumbnailWorker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.thumbnailWorker.addEventListener("message", handler);
      this.thumbnailWorker.postMessage({
        duration,
        type: ThumbnailWorkerRequestType.FillThumbnails,
      });
    });
  }

  /** Terminates both workers. The manager is unusable after this. */
  dispose(): void {
    this.disposed = true;
    this.playbackWorker.terminate();
    this.thumbnailWorker.terminate();
  }

  /**
   * Terminates + respawns the playback worker — instantly stopping any in-flight
   * decode on its thread — and spawns a fresh idle replacement. Called when
   * switching files.
   */
  recyclePlaybackWorker(): void {
    if (this.disposed) return;
    this.decodedFps = 0;
    this.playbackWorker.terminate();
    this.playbackWorker = this.spawnPlaybackWorker();
    this.hasTransferredCanvas = false;
  }

  /**
   * Terminates + respawns the thumbnail worker — instantly stopping any
   * in-flight probe/fill on its thread. Called when switching files, when
   * disabling preview thumbnails, and on probe timeout.
   */
  recycleThumbnailWorker(): void {
    if (this.disposed) return;
    this.thumbnailWorker.terminate();
    this.thumbnailWorker = this.spawnThumbnailWorker();
  }

  /** Loads the file into the playback worker (videoSink). */
  loadFileForPlayback(params: ILoadFileParams): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent<PlaybackWorkerEvent>) => {
        const message = event.data;
        if (message.type === PlaybackWorkerEventType.LoadFileComplete) {
          this.playbackWorker.removeEventListener("message", handler);
          resolve();
        } else if (message.type === PlaybackWorkerEventType.LoadFileError) {
          this.playbackWorker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.playbackWorker.addEventListener("message", handler);
      this.playbackWorker.postMessage({
        blob: params.blob,
        type: PlaybackWorkerRequestType.LoadFile,
        videoTrackIndex: params.videoTrackIndex,
      });
    });
  }

  /** Loads the file into the thumbnail worker (thumbnailSink). */
  loadFileForPreviewThumbnails(params: ILoadFileParams): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent<ThumbnailWorkerEvent>) => {
        const message = event.data;
        if (message.type === ThumbnailWorkerEventType.LoadFileComplete) {
          this.thumbnailWorker.removeEventListener("message", handler);
          resolve();
        } else if (message.type === ThumbnailWorkerEventType.LoadFileError) {
          this.thumbnailWorker.removeEventListener("message", handler);
          reject(message.error);
        }
      };
      this.thumbnailWorker.addEventListener("message", handler);
      this.thumbnailWorker.postMessage({
        blob: params.blob,
        type: ThumbnailWorkerRequestType.LoadFile,
        videoTrackIndex: params.videoTrackIndex,
      });
    });
  }

  private spawnPlaybackWorker(): Worker {
    const worker = new Worker(
      new URL("../playback-worker/playbackWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<PlaybackWorkerEvent>) => {
      const message = event.data;
      if (message.type === PlaybackWorkerEventType.DecodedFrameRate) {
        this.decodedFps = message.fps;
      } else if (message.type === PlaybackWorkerEventType.DecodeError) {
        console.error(
          "DecodeWorkerManager: playback decode error:",
          message.error,
        );
      }
    };
    return worker;
  }

  private spawnThumbnailWorker(): Worker {
    const worker = new Worker(
      new URL("../thumbnail-worker/thumbnailWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<ThumbnailWorkerEvent>) => {
      const message = event.data;
      if (message.type === ThumbnailWorkerEventType.FillThumbnailsError) {
        console.error(
          "DecodeWorkerManager: thumbnail decode error:",
          message.error,
        );
      }
    };
    return worker;
  }
}

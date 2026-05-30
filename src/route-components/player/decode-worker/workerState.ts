import { CanvasSink, WrappedCanvas } from "mediabunny";
import { IPlaybackDrawState } from "./utils/drawAndRecordFrame";

export interface IPlaybackState {
  asyncId: number;
  drawState: IPlaybackDrawState;
  isPlaying: boolean;
  iterator: AsyncGenerator<WrappedCanvas, void, unknown> | undefined;
  nextFrame: WrappedCanvas | undefined;
  offscreenCanvas: OffscreenCanvas;
}

/**
 * Module-level mutable state for the decode worker. Handlers read and write
 * these fields directly; the worker is single-threaded so no synchronization
 * is needed.
 *
 * The worker is terminated and respawned per file (see `terminateWorker` in
 * DecodeWorkerManager), so this state starts fresh for every file — no explicit
 * between-file reset is needed.
 *
 * - `thumbnailSink` is set on LoadFile. Separate from `videoSink` to avoid
 *   iterator pool conflicts.
 * - `videoSink` is set on LoadFile.
 * - `playbackState` is set on StartPlayback, which transfers the offscreen
 *   canvas.
 */
export const workerState: {
  playbackState: IPlaybackState | undefined;
  thumbnailSink: CanvasSink | undefined;
  videoSink: CanvasSink | undefined;
} = {
  playbackState: undefined,
  thumbnailSink: undefined,
  videoSink: undefined,
};

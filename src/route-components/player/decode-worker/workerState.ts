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
 * - `thumbnailSink` is set on LoadFile (one per loaded file) and cleared on
 *   Reset. Separate from `videoSink` to avoid iterator pool conflicts.
 * - `videoSink` is set on LoadFile (one per loaded file) and cleared on Reset.
 * - `playbackState` is set on the first StartPlayback (which transfers the
 *   offscreen canvas) and persists across files; Reset only clears its
 *   iterator-level fields, leaving the canvas + drawState intact.
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

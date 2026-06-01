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
 * Module-level mutable state for the playback worker. Handlers read and write
 * these fields directly; the worker is single-threaded so no synchronization is
 * needed. The worker is terminated and respawned per file, so this state starts
 * fresh for every file.
 *
 * - `videoSink` is set on LoadFile.
 * - `playbackState` is set on StartPlayback, which transfers the offscreen
 *   canvas.
 */
export const workerState: {
  playbackState: IPlaybackState | undefined;
  videoSink: CanvasSink | undefined;
} = {
  playbackState: undefined,
  videoSink: undefined,
};

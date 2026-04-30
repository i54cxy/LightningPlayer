import { workerState } from "../workerState";

export const handleReset = () => {
  workerState.thumbnailSink = undefined;
  workerState.videoSink = undefined;
  const { playbackState } = workerState;
  if (!playbackState) return;
  // Bump asyncId so any in-flight iterator.next() bails out.
  playbackState.asyncId += 1;
  const previousIterator = playbackState.iterator;
  playbackState.iterator = undefined;
  playbackState.nextFrame = undefined;
  playbackState.drawState.lastDrawnFrame = undefined;
  playbackState.isPlaying = false;
  if (previousIterator) {
    void previousIterator.return();
  }
  playbackState.drawState.ctx.clearRect(
    0,
    0,
    playbackState.offscreenCanvas.width,
    playbackState.offscreenCanvas.height,
  );
  // The offscreen canvas + drawState are kept across files: the
  // OffscreenCanvas was transferred once and cannot be re-transferred.
};

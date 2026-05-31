import { toError } from "../../../../shared/utils/toError";
import {
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { drawAndRecordFrame } from "../utils/drawAndRecordFrame";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

// Tracks the actual on-screen frame rate (frames drawn per second) and reports
// it to the main thread roughly once per second. Module-level state resets with
// the worker, which is respawned per file.
let drawnFrameCount = 0;
let frameRateWindowStart = 0;

/** Counts a drawn frame and posts the measured rate once per ~second. */
const reportDrawnFrame = () => {
  drawnFrameCount += 1;
  const now = performance.now();
  if (frameRateWindowStart === 0) {
    frameRateWindowStart = now;
    return;
  }
  const elapsed = now - frameRateWindowStart;
  if (elapsed < 1000) return;
  // Skip windows that span a pause or seek gap (no ticks) to avoid a misleading
  // dip in the reported rate.
  if (elapsed <= 2000) {
    self.postMessage({
      fps: Math.round((drawnFrameCount * 1000) / elapsed),
      type: DecodeWorkerEventType.DecodedFrameRate,
    });
  }
  drawnFrameCount = 0;
  frameRateWindowStart = now;
};

// Processes at most one frame per call. The main thread drives this via
// requestAnimationFrame ticks so we never run ahead of vsync.
export const handleTick = async ({
  currentTime,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.Tick }
>) => {
  const { playbackState } = workerState;
  if (!playbackState || !playbackState.isPlaying) return;
  const { iterator, nextFrame } = playbackState;
  if (!nextFrame || nextFrame.timestamp > currentTime) return;
  if (!iterator) return;

  drawAndRecordFrame({
    drawState: playbackState.drawState,
    wrappedCanvas: nextFrame,
  });
  playbackState.nextFrame = undefined;
  reportDrawnFrame();

  const localAsyncId = playbackState.asyncId;
  try {
    const result = await iterator.next();
    if (localAsyncId !== playbackState.asyncId) return;
    if (result.done) {
      playbackState.iterator = undefined;
      return;
    }
    playbackState.nextFrame = result.value;
  } catch (error) {
    if (localAsyncId !== playbackState.asyncId) return;
    self.postMessage({
      error: toError(error),
      type: DecodeWorkerEventType.DecodeError,
    });
  }
};

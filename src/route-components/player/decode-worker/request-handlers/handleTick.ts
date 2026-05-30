import { toError } from "../../../../shared/utils/toError";
import {
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { drawAndRecordFrame } from "../utils/drawAndRecordFrame";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

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

import { toError } from "../../../../shared/utils/toError";
import {
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { drawAndRecordFrame } from "../utils/drawAndRecordFrame";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

export const handleSeek = async ({
  time,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.Seek }
>) => {
  const { playbackState, videoSink } = workerState;
  if (!videoSink || !playbackState) return;

  playbackState.asyncId += 1;
  const localAsyncId = playbackState.asyncId;

  const previousIterator = playbackState.iterator;
  playbackState.iterator = undefined;
  playbackState.nextFrame = undefined;
  playbackState.drawState.lastDrawnFrame = undefined;
  if (previousIterator) {
    void previousIterator.return();
  }

  try {
    // Prefetch two frames: draw the first immediately so the user sees the
    // seek position, then buffer the second in nextFrame for handleTick.
    const iterator = videoSink.canvases(time);
    const firstResult = await iterator.next();
    if (localAsyncId !== playbackState.asyncId) {
      void iterator.return();
      return;
    }
    if (firstResult.done) {
      playbackState.iterator = undefined;
      return;
    }
    drawAndRecordFrame({
      drawState: playbackState.drawState,
      wrappedCanvas: firstResult.value,
    });

    const secondResult = await iterator.next();
    if (localAsyncId !== playbackState.asyncId) {
      void iterator.return();
      return;
    }
    if (secondResult.done) {
      playbackState.iterator = undefined;
      return;
    }
    playbackState.iterator = iterator;
    playbackState.nextFrame = secondResult.value;
  } catch (error) {
    if (localAsyncId !== playbackState.asyncId) return;
    self.postMessage({
      error: toError(error),
      type: DecodeWorkerEventType.DecodeError,
    });
  }
};

import { toError } from "../../../../shared/utils/toError";
import {
  PlaybackWorkerEventType,
  PlaybackWorkerRequest,
  PlaybackWorkerRequestType,
} from "../playbackWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

export const handleStartPlayback = ({
  drawParams,
  offscreenCanvas,
}: Extract<
  PlaybackWorkerRequest,
  { type: PlaybackWorkerRequestType.StartPlayback }
>) => {
  try {
    if (!workerState.videoSink) {
      throw new Error("Worker not initialized.");
    }
    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from offscreen canvas.");
    }
    offscreenCanvas.width = drawParams.screenDimensions.width;
    offscreenCanvas.height = drawParams.screenDimensions.height;
    workerState.playbackState = {
      asyncId: 0,
      drawState: {
        ctx,
        flipHorizontal: drawParams.flipHorizontal,
        flipVertical: drawParams.flipVertical,
        lastDrawnFrame: undefined,
        rotation: drawParams.rotation,
        screenDimensions: drawParams.screenDimensions,
      },
      isPlaying: false,
      iterator: undefined,
      nextFrame: undefined,
      offscreenCanvas,
    };
    self.postMessage({ type: PlaybackWorkerEventType.StartPlaybackComplete });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      type: PlaybackWorkerEventType.StartPlaybackError,
    });
  }
};

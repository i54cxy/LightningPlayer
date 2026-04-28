import {
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { drawAndRecordFrame } from "../utils/drawAndRecordFrame";
import { workerState } from "../workerState";

export const handleUpdateDrawParams = ({
  partial,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.UpdateDrawParams }
>) => {
  const { playbackState } = workerState;
  if (!playbackState) return;
  const previousDimensions = playbackState.drawState.screenDimensions;
  Object.assign(playbackState.drawState, partial);
  const newDimensions = playbackState.drawState.screenDimensions;
  const dimensionsChanged =
    previousDimensions.width !== newDimensions.width ||
    previousDimensions.height !== newDimensions.height;
  if (dimensionsChanged) {
    playbackState.offscreenCanvas.width = newDimensions.width;
    playbackState.offscreenCanvas.height = newDimensions.height;
  }
  if (playbackState.drawState.lastDrawnFrame) {
    drawAndRecordFrame({
      drawState: playbackState.drawState,
      wrappedCanvas: playbackState.drawState.lastDrawnFrame,
    });
  }
};

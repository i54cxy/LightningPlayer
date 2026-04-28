import { toError } from "../../../../shared/utils/toError";
import {
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

export const handleProbe = async ({
  timestamp,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.Probe }
>) => {
  try {
    const { videoSink } = workerState;
    if (!videoSink) {
      throw new Error("Worker not initialized.");
    }
    const startTime = performance.now();
    await videoSink.getCanvas(timestamp);
    const durationMs = performance.now() - startTime;
    self.postMessage({ durationMs, type: DecodeWorkerEventType.ProbeResult });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      type: DecodeWorkerEventType.ProbeError,
    });
  }
};

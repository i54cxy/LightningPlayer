import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import { toError } from "../../../../shared/utils/toError";
import {
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

export const handleLoadFile = async ({
  blob,
  videoTrackIndex,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.LoadFile }
>) => {
  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });
    const allTracks = await input.getTracks();
    const videoTrack = allTracks[videoTrackIndex];
    if (!videoTrack || !videoTrack.isVideoTrack()) {
      throw new Error(
        `Track at index ${videoTrackIndex} is not a video track.`,
      );
    }
    workerState.thumbnailSink = new CanvasSink(videoTrack, {
      fit: "contain",
    });
    workerState.videoSink = new CanvasSink(videoTrack, {
      fit: "contain",
      poolSize: 2,
    });
    self.postMessage({ type: DecodeWorkerEventType.LoadFileComplete });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      type: DecodeWorkerEventType.LoadFileError,
    });
  }
};

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import { toError } from "../../../../shared/utils/toError";
import {
  PlaybackWorkerEventType,
  PlaybackWorkerRequest,
  PlaybackWorkerRequestType,
} from "../playbackWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

export const handleLoadFile = async ({
  blob,
  videoTrackIndex,
}: Extract<
  PlaybackWorkerRequest,
  { type: PlaybackWorkerRequestType.LoadFile }
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
    workerState.videoSink = new CanvasSink(videoTrack, {
      fit: "contain",
      poolSize: 2,
    });
    self.postMessage({ type: PlaybackWorkerEventType.LoadFileComplete });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      type: PlaybackWorkerEventType.LoadFileError,
    });
  }
};

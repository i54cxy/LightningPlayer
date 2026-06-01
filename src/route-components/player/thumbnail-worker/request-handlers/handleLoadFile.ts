import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import { toError } from "../../../../shared/utils/toError";
import {
  ThumbnailWorkerEventType,
  ThumbnailWorkerRequest,
  ThumbnailWorkerRequestType,
} from "../thumbnailWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

/**
 * Opens the file and constructs the `thumbnailSink` used to decode preview
 * thumbnails. Resolves once the sink is ready.
 *
 * @param params.blob - The media file.
 * @param params.videoTrackIndex - Index of the video track to decode.
 */
export const handleLoadFile = async ({
  blob,
  videoTrackIndex,
}: Extract<
  ThumbnailWorkerRequest,
  { type: ThumbnailWorkerRequestType.LoadFile }
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
    self.postMessage({ type: ThumbnailWorkerEventType.LoadFileComplete });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      type: ThumbnailWorkerEventType.LoadFileError,
    });
  }
};

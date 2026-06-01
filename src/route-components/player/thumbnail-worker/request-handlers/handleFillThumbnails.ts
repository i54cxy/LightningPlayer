import {
  previewThumbnailHeight,
  previewThumbnailWidth,
} from "../../../../ui-components/base/preview-thumbnail/PreviewThumbnail.types";
import { toError } from "../../../../shared/utils/toError";
import {
  ThumbnailWorkerEventType,
  ThumbnailWorkerRequest,
  ThumbnailWorkerRequestType,
} from "../thumbnailWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

/**
 * Decodes one thumbnail per second of the file in a single sequential pass via
 * `canvasesAtTimestamps` (the monotonically-sorted timestamps let it decode each
 * packet at most once), resizes each frame to fit the preview thumbnail
 * dimensions, and streams it back as a transferable `ImageBitmap` — no JPEG
 * encode. Each frame is keyed by its requested timestamp. Posts
 * `FillThumbnailsComplete` when done.
 *
 * @param params.duration - Total file duration in seconds.
 */
export const handleFillThumbnails = async ({
  duration,
}: Extract<
  ThumbnailWorkerRequest,
  { type: ThumbnailWorkerRequestType.FillThumbnails }
>) => {
  try {
    const { thumbnailSink } = workerState;
    if (!thumbnailSink) {
      throw new Error("thumbnailSink is not initialized.");
    }

    // One thumbnail per second, sorted so the decode pipeline stays sequential.
    const timestamps: number[] = [];
    for (let t = 0; t <= Math.floor(duration); t += 1) {
      timestamps.push(t);
    }

    let index = 0;
    for await (const wrapped of thumbnailSink.canvasesAtTimestamps(
      timestamps,
    )) {
      const timestamp = timestamps[index];
      index += 1;
      if (!wrapped || timestamp === undefined) {
        continue;
      }

      // Scale to fit within thumbnail dimensions while keeping aspect ratio.
      const srcWidth = wrapped.canvas.width;
      const srcHeight = wrapped.canvas.height;
      const scale = Math.min(
        previewThumbnailWidth / srcWidth,
        previewThumbnailHeight / srcHeight,
      );
      const dstWidth = Math.round(srcWidth * scale);
      const dstHeight = Math.round(srcHeight * scale);

      const offscreen = new OffscreenCanvas(dstWidth, dstHeight);
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2d context from OffscreenCanvas.");
      }
      ctx.drawImage(wrapped.canvas, 0, 0, dstWidth, dstHeight);
      // Hand the pixels to the main thread without a JPEG round-trip.
      const imageBitmap = offscreen.transferToImageBitmap();

      self.postMessage(
        {
          imageBitmap,
          timestamp,
          type: ThumbnailWorkerEventType.ThumbnailReady,
        },
        [imageBitmap],
      );
    }

    self.postMessage({ type: ThumbnailWorkerEventType.FillThumbnailsComplete });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      type: ThumbnailWorkerEventType.FillThumbnailsError,
    });
  }
};

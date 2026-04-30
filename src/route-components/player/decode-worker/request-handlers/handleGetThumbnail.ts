import {
  previewThumbnailHeight,
  previewThumbnailWidth,
} from "../../../../ui-components/base/preview-thumbnail/PreviewThumbnail.types";
import { toError } from "../../../../shared/utils/toError";
import {
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

/** JPEG quality for thumbnails (0-1). */
const THUMBNAIL_QUALITY = 0.8;

/**
 * Decodes one frame at the given timestamp, resizes it to thumbnail
 * dimensions, encodes to JPEG, and posts the blob back to the main thread.
 * Falls back to the first iterator frame when `getCanvas` returns null at
 * timestamp 0.
 *
 * @param params - The request payload with requestId and timestamp.
 */
export const handleGetThumbnail = async ({
  requestId,
  timestamp,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.GetThumbnail }
>) => {
  try {
    const { thumbnailSink } = workerState;
    if (!thumbnailSink) {
      throw new Error("thumbnailSink is not initialized.");
    }

    let canvas = await thumbnailSink.getCanvas(timestamp);

    // Fallback to the first frame at 0s.
    if (!canvas && timestamp === 0) {
      const iterator = thumbnailSink.canvases(timestamp);
      canvas = (await iterator.next()).value ?? null;
      await iterator.return();
    }

    if (!canvas) {
      throw new Error(`No frame available at timestamp ${timestamp}.`);
    }

    const srcWidth = canvas.canvas.width;
    const srcHeight = canvas.canvas.height;

    // Scale to fit within thumbnail dimensions while maintaining aspect ratio.
    const scale = Math.min(
      previewThumbnailWidth / srcWidth,
      previewThumbnailHeight / srcHeight,
    );
    const dstHeight = Math.round(srcHeight * scale);
    const dstWidth = Math.round(srcWidth * scale);

    const tempCanvas = new OffscreenCanvas(dstWidth, dstHeight);
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2d context from OffscreenCanvas.");
    }

    const bitmap = await createImageBitmap(canvas.canvas);
    ctx.drawImage(bitmap, 0, 0, dstWidth, dstHeight);
    bitmap.close();

    const blob = await tempCanvas.convertToBlob({
      quality: THUMBNAIL_QUALITY,
      type: "image/jpeg",
    });

    self.postMessage({
      blob,
      requestId,
      type: DecodeWorkerEventType.GetThumbnailResult,
    });
  } catch (error) {
    self.postMessage({
      error: toError(error),
      requestId,
      type: DecodeWorkerEventType.GetThumbnailError,
    });
  }
};

import {
  previewThumbnailHeight,
  previewThumbnailWidth,
} from "../../../ui-components/base/preview-thumbnail/PreviewThumbnail.styles";

/** JPEG quality for thumbnails (0-1). */
const THUMBNAIL_QUALITY = 0.8;

/**
 * Converts an HTMLCanvasElement or OffscreenCanvas to a Blob.
 *
 * @param canvas - The source canvas.
 * @param options - Optional settings for format and quality.
 * @returns A promise that resolves to the blob.
 */
export const canvasToBlob = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: { quality?: number; type?: string },
): Promise<Blob | null> => {
  const type = options?.type ?? "image/png";
  const quality = options?.quality;

  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ quality, type });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
};

/**
 * Converts a canvas to a thumbnail-sized JPEG blob.
 * Resizes to fit within previewThumbnailHeight x previewThumbnailWidth while maintaining aspect ratio.
 *
 * @param canvas - The source canvas (full resolution).
 * @returns A promise that resolves to a small JPEG blob.
 */
export const canvasToThumbnailBlob = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob | null> => {
  const srcWidth = canvas.width;
  const srcHeight = canvas.height;

  // Calculate scaled dimensions maintaining aspect ratio.
  const scale = Math.min(
    previewThumbnailWidth / srcWidth,
    previewThumbnailHeight / srcHeight,
  );
  const dstWidth = Math.round(srcWidth * scale);
  const dstHeight = Math.round(srcHeight * scale);

  // Create a temporary canvas at thumbnail size.
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = dstWidth;
  tempCanvas.height = dstHeight;

  const ctx = tempCanvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  // Draw scaled image.
  if (canvas instanceof OffscreenCanvas) {
    // OffscreenCanvas can't be drawn directly, need to convert to ImageBitmap.
    const bitmap = await createImageBitmap(canvas);
    ctx.drawImage(bitmap, 0, 0, dstWidth, dstHeight);
    bitmap.close();
  } else {
    ctx.drawImage(canvas, 0, 0, dstWidth, dstHeight);
  }

  // Convert to JPEG with quality setting.
  return canvasToBlob(tempCanvas, {
    quality: THUMBNAIL_QUALITY,
    type: "image/jpeg",
  });
};

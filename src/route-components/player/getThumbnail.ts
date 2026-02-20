import { CanvasSink } from "mediabunny";
import { formatTimestamp } from "../../shared/utils/formatTimestamp";
import { canvasToThumbnailBlob } from "./canvasToBlob";
import { PreviewThumbnailCache } from "./PreviewThumbnailCache";

/**
 * Fetches a thumbnail for the given timestamp, using cache if available.
 * Falls back to fetching directly from the video sink when no cache is provided.
 *
 * @param params.thumbnailCache - The thumbnail cache instance.
 * @param params.timestamp - The timestamp in seconds.
 * @param params.videoSink - Fallback video sink used when no cache is available.
 * @returns A promise that resolves to an object URL of the thumbnail image, or undefined if unavailable.
 */
export const getThumbnail = async ({
  thumbnailCache,
  timestamp,
  videoSink,
}: {
  thumbnailCache: PreviewThumbnailCache | undefined;
  timestamp: number;
  videoSink: CanvasSink | undefined;
}): Promise<string | undefined> => {
  // Round timestamp to nearest second to match auto-fill cache entries.
  const roundedTimestamp = Math.round(timestamp);
  const formattedTimestamp = formatTimestamp(roundedTimestamp);

  if (thumbnailCache) {
    // Check cache first.
    const cached = thumbnailCache.get(roundedTimestamp);
    if (cached) {
      // console.log(
      //   `getThumbnail: cache hit for ${formattedTimestamp}`,
      // );
      return cached;
    }

    console.log(`getThumbnail: cache miss for ${formattedTimestamp}`);

    const startTime = performance.now();
    const result = await thumbnailCache.fetchAndCache(roundedTimestamp);
    const endTime = performance.now();
    console.log(
      `getThumbnail: fetchAndCache for ${formattedTimestamp} took ${endTime - startTime} ms`,
    );

    // if (result) {
    //   console.log(`getThumbnail: cache set for ${formattedTimestamp}`);
    // }
    return result;
  }

  if (videoSink) {
    // No cache available - fetch directly from the sink without caching.
    const startTime = performance.now();
    const canvas = await videoSink.getCanvas(roundedTimestamp);
    if (!canvas) {
      console.error(`getThumbnail: getCanvas failed for ${formattedTimestamp}`);
      return;
    }

    const blob = await canvasToThumbnailBlob(canvas.canvas);
    if (!blob) {
      console.error(
        `getThumbnail: canvasToThumbnailBlob failed for ${formattedTimestamp}`,
      );
      return;
    }
    const endTime = performance.now();
    console.log(
      `getThumbnail: fetchAndCache for ${formattedTimestamp} took ${endTime - startTime} ms`,
    );

    return URL.createObjectURL(blob);
  }
};

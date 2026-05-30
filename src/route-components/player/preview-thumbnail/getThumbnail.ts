import { formatTimestamp } from "../../../shared/utils/formatTimestamp";
import { PreviewThumbnailCache } from "./PreviewThumbnailCache";

/**
 * Fetches a thumbnail for the given timestamp via the cache. Returns
 * undefined when no cache is available — this means preview thumbnails are
 * disabled for this file.
 *
 * @param params.thumbnailCache - The thumbnail cache instance.
 * @param params.timestamp - The timestamp in seconds.
 * @returns A promise that resolves to an object URL of the thumbnail image, or undefined if unavailable.
 */
export const getThumbnail = async ({
  thumbnailCache,
  timestamp,
}: {
  thumbnailCache: PreviewThumbnailCache | undefined;
  timestamp: number;
}): Promise<string | undefined> => {
  if (!thumbnailCache) return;

  // Round timestamp to nearest second for cache key consistency.
  const roundedTimestamp = Math.round(timestamp);
  const formattedTimestamp = formatTimestamp(roundedTimestamp);

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
};

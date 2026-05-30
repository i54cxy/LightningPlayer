import { formatTimestamp } from "../../../shared/utils/formatTimestamp";
import { DecodeWorkerManager } from "../decode-worker/DecodeWorkerManager";

interface ICachedThumbnail {
  sizeBytes: number;
  url: string;
}

const DEFAULT_MAX_MEMORY_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * LRU cache for video thumbnails with memory-based eviction.
 */
export class PreviewThumbnailCache {
  // Map maintains insertion order; we move accessed items to end for LRU behavior.
  private cache = new Map<number, ICachedThumbnail>();
  private decodeWorkerManager: DecodeWorkerManager;
  private maxMemoryBytes: number;
  private totalMemoryBytes = 0;

  /**
   * @param params.decodeWorkerManager - The decode worker manager for fetching thumbnails.
   * @param params.maxMemoryBytes - Maximum memory in bytes for cached thumbnails. Default: 100MB.
   */
  constructor({
    decodeWorkerManager,
    maxMemoryBytes = DEFAULT_MAX_MEMORY_BYTES,
  }: {
    decodeWorkerManager: DecodeWorkerManager;
    maxMemoryBytes?: number;
  }) {
    this.decodeWorkerManager = decodeWorkerManager;
    this.maxMemoryBytes = maxMemoryBytes;
  }

  /**
   * Clears the cache, revoking all blob URLs and emptying entries. The cache
   * remains usable afterwards.
   */
  reset(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.totalMemoryBytes = 0;
    console.log("PreviewThumbnailCache: reset");
  }

  /**
   * Fetches a thumbnail via the worker and adds it to the cache.
   *
   * @param timestamp - The timestamp to fetch.
   * @returns The blob URL, or undefined on failure.
   */
  async fetchAndCache(timestamp: number): Promise<string | undefined> {
    try {
      const blob = await this.decodeWorkerManager.getThumbnail(timestamp);
      const url = URL.createObjectURL(blob);
      this.set(timestamp, url, blob.size);
      return url;
    } catch (error) {
      console.error(
        `PreviewThumbnailCache: error fetching thumbnail at ${formatTimestamp(timestamp)}:`,
        error,
      );
      return;
    }
  }

  /**
   * Gets a cached thumbnail URL for the given timestamp.
   *
   * @param timestamp - The timestamp in seconds.
   * @returns The cached blob URL, or undefined if not cached.
   */
  get(timestamp: number): string | undefined {
    const entry = this.cache.get(timestamp);
    if (entry) {
      // Move to end for LRU behavior.
      this.cache.delete(timestamp);
      this.cache.set(timestamp, entry);
      return entry.url;
    }
  }

  /**
   * Adds a thumbnail to the cache, evicting old entries if over memory limit.
   *
   * @param timestamp - The timestamp in seconds.
   * @param url - The blob URL for the thumbnail.
   * @param sizeBytes - The size of the blob in bytes.
   */
  private set(timestamp: number, url: string, sizeBytes: number): void {
    // If already cached, revoke old URL and update.
    const existing = this.cache.get(timestamp);
    if (existing) {
      URL.revokeObjectURL(existing.url);
      this.totalMemoryBytes -= existing.sizeBytes;
      this.cache.delete(timestamp);
    }

    // Evict oldest entries until we have room.
    while (
      this.cache.size > 0 &&
      this.totalMemoryBytes + sizeBytes > this.maxMemoryBytes
    ) {
      this.evictOldest();
    }

    // Add new entry.
    this.cache.set(timestamp, { sizeBytes, url });
    this.totalMemoryBytes += sizeBytes;
  }

  /**
   * Evicts the oldest (least recently used) entry from the cache.
   */
  private evictOldest(): void {
    // Map iterator gives entries in insertion order; first entry is oldest.
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      const entry = this.cache.get(firstKey);
      if (entry) {
        URL.revokeObjectURL(entry.url);
        this.totalMemoryBytes -= entry.sizeBytes;
        this.cache.delete(firstKey);
        // console.log(`ThumbnailCache: evicted thumbnail at ${firstKey}s`);
      }
    }
  }
}

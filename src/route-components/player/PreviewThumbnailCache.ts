import { CanvasSink } from "mediabunny";
import { formatTimestamp } from "../../shared/utils/formatTimestamp";
import { canvasToThumbnailBlob } from "./canvasToBlob";

export interface IPreviewThumbnailCacheConfig {
  /**
   * Interval in seconds between auto-fill thumbnails. Default: 1.
   */
  fillIntervalSeconds: number;
  /**
   * Maximum memory in bytes for cached thumbnails. Default: 100MB.
   */
  maxMemoryBytes: number;
}

interface ICachedThumbnail {
  sizeBytes: number;
  timestamp: number;
  url: string;
}

const DEFAULT_CONFIG: IPreviewThumbnailCacheConfig = {
  fillIntervalSeconds: 1,
  maxMemoryBytes: 100 * 1024 * 1024, // 100MB
};

/**
 * LRU cache for video thumbnails with memory-based eviction and background auto-fill.
 */
export class PreviewThumbnailCache {
  // Map maintains insertion order; we move accessed items to end for LRU behavior.
  private cache = new Map<number, ICachedThumbnail>();
  private config: IPreviewThumbnailCacheConfig;
  private duration: number;
  // Session ID for auto-fill; incremented to invalidate running loops.
  private linearAsyncId = 0;
  private totalMemoryBytes = 0;
  private videoSink: CanvasSink;

  /**
   * Creates a new ThumbnailCache instance.
   *
   * @param params - Configuration and video source.
   */
  constructor({
    config,
    duration,
    videoSink,
  }: {
    config?: Partial<IPreviewThumbnailCacheConfig>;
    duration: number;
    videoSink: CanvasSink;
  }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.duration = duration;
    this.videoSink = videoSink;
  }

  /**
   * Disposes of the cache, revoking all blob URLs and clearing entries.
   */
  dispose(): void {
    this.stopAutoFill();
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.totalMemoryBytes = 0;
    console.log("PreviewThumbnailCache: disposed");
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
   * Gets the current configuration.
   *
   * @returns The current cache configuration.
   */
  getConfig(): IPreviewThumbnailCacheConfig {
    return { ...this.config };
  }

  /**
   * Gets the current memory usage in bytes.
   *
   * @returns Total memory used by cached thumbnails.
   */
  getMemoryUsage(): number {
    return this.totalMemoryBytes;
  }

  /**
   * Gets the number of cached entries.
   *
   * @returns Number of thumbnails in cache.
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Checks if a timestamp is already cached.
   *
   * @param timestamp - The timestamp in seconds.
   * @returns True if the timestamp is cached.
   */
  has(timestamp: number): boolean {
    return this.cache.has(timestamp);
  }

  /**
   * Adds a thumbnail to the cache, evicting old entries if over memory limit.
   *
   * @param timestamp - The timestamp in seconds.
   * @param url - The blob URL for the thumbnail.
   * @param sizeBytes - The size of the blob in bytes.
   */
  set(timestamp: number, url: string, sizeBytes: number): void {
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
      this.totalMemoryBytes + sizeBytes > this.config.maxMemoryBytes
    ) {
      this.evictOldest();
    }

    // Add new entry.
    this.cache.set(timestamp, { sizeBytes, timestamp, url });
    this.totalMemoryBytes += sizeBytes;
  }

  /**
   * Fetches a thumbnail and adds it to the cache.
   * Falls back to iterator if getCanvas returns null (e.g., no frame at exact timestamp 0).
   *
   * @param timestamp - The timestamp to fetch.
   * @returns True if fetch was successful.
   */
  async fetchAndCache(timestamp: number): Promise<string | undefined> {
    try {
      let canvas = await this.videoSink.getCanvas(timestamp);

      // Fallback to the first frame at 0s.
      if (!canvas && timestamp === 0) {
        const iterator = this.videoSink.canvases(timestamp);
        canvas = (await iterator.next()).value ?? null;
        await iterator.return();
      }

      if (!canvas) {
        console.error(
          `PreviewThumbnailCache: error fetching canvas at ${timestamp}`,
        );
        return;
      }

      const blob = await canvasToThumbnailBlob(canvas.canvas);

      if (!blob) {
        console.error("PreviewThumbnailCache: error converting to blob");
        return;
      }

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
   * Starts the auto-fill process from a given timestamp, expanding bidirectionally.
   * Cancels any previously running auto-fill.
   *
   * @param timestamp - The starting timestamp in seconds. Defaults to 0.
   */
  startAutoFill(timestamp = 0): void {
    this.runAutoFillLinear(timestamp);
  }

  /**
   * Stops the background auto-fill process.
   */
  stopAutoFill(): void {
    this.stopAutoFillLinear();
  }

  /**
   * Runs the auto-fill process, fetching thumbnails bidirectionally.
   *
   * @param asyncId - The session ID to check for cancellation.
   * @param startTimestamp - The starting timestamp in seconds.
   */
  private async runAutoFillLinear(startTimestamp: number): Promise<void> {
    const asyncId = ++this.linearAsyncId;
    const interval = this.config.fillIntervalSeconds;
    // Round to nearest interval for cache key consistency with getThumbnail.
    const roundedStart = Math.round(startTimestamp / interval) * interval;

    let left = roundedStart;
    let right = roundedStart + interval;
    let loggedSize = 0;

    while (true) {
      const canFetchLeft = left >= 0;
      const canFetchRight = right <= this.duration;

      // Log progress every 50 thumbnails.
      const currentSize = this.cache.size;
      const logLeft = canFetchLeft ? left : 0;
      const logRight = canFetchRight ? right : this.duration;
      if (currentSize > 0 && currentSize - loggedSize >= 50) {
        console.log(
          `PreviewThumbnailCache: auto-fill progress [${formatTimestamp(logLeft)}, ${formatTimestamp(logRight)}] / ${formatTimestamp(this.duration)} (${currentSize} thumbnails, ${(this.totalMemoryBytes / 1024 / 1024).toFixed(1)}MB)`,
        );
        loggedSize = currentSize;
      }

      // Check cancellation.
      if (asyncId !== this.linearAsyncId) return;

      // Check memory limit.
      if (this.totalMemoryBytes >= this.config.maxMemoryBytes) {
        console.log(
          `PreviewThumbnailCache: auto-fill stopped at [${formatTimestamp(logLeft)}, ${formatTimestamp(logRight)}] (memory limit reached: ${(this.totalMemoryBytes / 1024 / 1024).toFixed(1)}MB)`,
        );
        return;
      }

      // Exit when both directions exhausted.
      if (!canFetchLeft && !canFetchRight) {
        console.log(
          `PreviewThumbnailCache: auto-fill complete (${this.cache.size} thumbnails, ${(this.totalMemoryBytes / 1024 / 1024).toFixed(1)}MB)`,
        );
        return;
      }

      // Go left.
      if (canFetchLeft) {
        if (!this.has(left)) {
          await this.fetchAndCache(left);
        }
        left -= interval;
      }

      // Go right.
      if (canFetchRight) {
        if (!this.has(right)) {
          await this.fetchAndCache(right);
        }
        right += interval;
      }

      // Yield to main thread to prevent blocking.
      await this.yieldToMainThread();
    }
  }

  /**
   * Stops the background linear auto-fill process.
   */
  private stopAutoFillLinear() {
    ++this.linearAsyncId;
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

  /**
   * Yields to the main thread using requestIdleCallback or setTimeout.
   *
   */
  private yieldToMainThread(): Promise<void> {
    return new Promise((resolve) => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 16); // ~60fps
      }
    });
  }
}

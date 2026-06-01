interface ICachedThumbnail {
  imageBitmap: ImageBitmap;
  sizeBytes: number;
}

/**
 * In-memory store of decoded preview thumbnails (`ImageBitmap`) keyed by
 * timestamp (rounded seconds). Filled in bulk by the thumbnail worker via
 * `DecodeWorkerManager.fillThumbnails`; lookups are pure memory reads (no
 * decode). `reset()` closes every bitmap and empties the store, which remains
 * usable afterwards.
 */
export class PreviewThumbnailCache {
  private cache = new Map<number, ICachedThumbnail>();
  private totalMemoryBytes = 0;

  /** Total bytes held by cached thumbnails (uncompressed RGBA). */
  get memoryBytes(): number {
    return this.totalMemoryBytes;
  }

  /** Number of cached thumbnails. */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Returns the cached thumbnail for the timestamp, or undefined if absent.
   *
   * @param timestamp - The timestamp in seconds.
   */
  get(timestamp: number): ImageBitmap | undefined {
    return this.cache.get(timestamp)?.imageBitmap;
  }

  /**
   * Closes all bitmaps and clears the store. The instance remains usable.
   */
  reset(): void {
    for (const entry of this.cache.values()) {
      entry.imageBitmap.close();
    }
    this.cache.clear();
    this.totalMemoryBytes = 0;
    console.log("PreviewThumbnailCache: reset");
  }

  /**
   * Stores a thumbnail, closing and replacing any existing one at the same key.
   *
   * @param timestamp - The timestamp in seconds.
   * @param imageBitmap - The decoded thumbnail bitmap.
   */
  set(timestamp: number, imageBitmap: ImageBitmap): void {
    const existing = this.cache.get(timestamp);
    if (existing) {
      existing.imageBitmap.close();
      this.totalMemoryBytes -= existing.sizeBytes;
    }
    const sizeBytes = imageBitmap.width * imageBitmap.height * 4;
    this.cache.set(timestamp, { imageBitmap, sizeBytes });
    this.totalMemoryBytes += sizeBytes;
  }
}

export enum ThumbnailWorkerRequestType {
  FillThumbnails = "FillThumbnails",
  LoadFile = "LoadFile",
}

export enum ThumbnailWorkerEventType {
  FillThumbnailsComplete = "FillThumbnailsComplete",
  FillThumbnailsError = "FillThumbnailsError",
  LoadFileComplete = "LoadFileComplete",
  LoadFileError = "LoadFileError",
  ThumbnailReady = "ThumbnailReady",
}

/** Message sent from the main thread to the thumbnail worker. */
export type ThumbnailWorkerRequest =
  | { duration: number; type: ThumbnailWorkerRequestType.FillThumbnails }
  | {
      blob: Blob;
      type: ThumbnailWorkerRequestType.LoadFile;
      videoTrackIndex: number;
    };

/**
 * Message sent from the thumbnail worker to the main thread. A fill streams one
 * ThumbnailReady per decoded frame, then FillThumbnailsComplete (or
 * FillThumbnailsError on failure).
 */
export type ThumbnailWorkerEvent =
  | { type: ThumbnailWorkerEventType.FillThumbnailsComplete }
  | { error: Error; type: ThumbnailWorkerEventType.FillThumbnailsError }
  | { type: ThumbnailWorkerEventType.LoadFileComplete }
  | { error: Error; type: ThumbnailWorkerEventType.LoadFileError }
  | {
      imageBitmap: ImageBitmap;
      timestamp: number;
      type: ThumbnailWorkerEventType.ThumbnailReady;
    };

export interface IDecodeWorkerManagerCallbacks {
  onDecodeError?: (error: Error) => void;
  onEndOfStream?: () => void;
}

export interface ILoadFileParams {
  blob: Blob;
  videoTrackIndex: number;
}

export interface IProbeFrameResult {
  /**
   * True if the per-request timeout fired before the worker finished the
   * single-frame decode. The manager terminates the hung worker and
   * transparently spins up a fresh one re-loaded to the same file.
   */
  aborted: boolean;
  /**
   * Wall-clock decode duration in milliseconds. Set only when `aborted` is
   * false.
   */
  durationMs?: number;
}

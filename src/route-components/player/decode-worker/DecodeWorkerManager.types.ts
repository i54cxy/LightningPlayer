export interface IDecodeWorkerManagerCallbacks {
  onDecodeError?: (error: Error) => void;
  onEndOfStream?: () => void;
}

export interface ILoadFileParams {
  blob: Blob;
  videoTrackIndex: number;
}

/**
 * Result of a single-frame decode probe.
 *
 * - `aborted: true` — the per-request timeout fired before the worker finished
 *   the decode. The manager terminates the hung worker and transparently spins
 *   up a fresh one re-loaded to the same file. No duration is available.
 * - `aborted: false` — the decode completed; `durationMs` is the wall-clock
 *   decode duration in milliseconds.
 */
export type IProbeFrameResult =
  | { aborted: true }
  | { aborted: false; durationMs: number };

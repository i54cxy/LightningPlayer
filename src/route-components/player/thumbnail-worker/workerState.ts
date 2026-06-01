import { CanvasSink } from "mediabunny";

/**
 * Module-level mutable state for the thumbnail worker. The worker is terminated
 * and respawned per file, so this state starts fresh for every file.
 *
 * - `thumbnailSink` is set on LoadFile.
 */
export const workerState: {
  thumbnailSink: CanvasSink | undefined;
} = {
  thumbnailSink: undefined,
};

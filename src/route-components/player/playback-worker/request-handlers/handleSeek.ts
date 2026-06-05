import { WrappedCanvas } from "mediabunny";

import { toError } from "../../../../shared/utils/toError";
import {
  PlaybackWorkerEventType,
  PlaybackWorkerRequest,
  PlaybackWorkerRequestType,
} from "../playbackWorker.types";
import { drawAndRecordFrame } from "../utils/drawAndRecordFrame";
import { workerState } from "../workerState";

declare const self: DedicatedWorkerGlobalScope;

// Seeks are serialized through this chain so the single CanvasSink's decoder is
// never driven by two iterators at once.
// `asyncId` (bumped synchronously per request) lets a queued-but-superseded seek
// bail before touching the decoder. (handleTick never runs concurrently — the
// player pauses, so `isPlaying` is false, before any seek.)
let seekChain: Promise<void> = Promise.resolve();

/**
 * Queues a seek onto the serialized seek chain. Bumps `asyncId` synchronously so
 * a later seek supersedes any still queued, then appends the actual work.
 *
 * @param request.seekId - Main-thread correlation id, echoed back in SeekComplete.
 * @param request.time - Target timestamp in seconds.
 */
export const handleSeek = ({
  seekId: requestSeekId,
  time,
}: Extract<
  PlaybackWorkerRequest,
  { type: PlaybackWorkerRequestType.Seek }
>) => {
  const { playbackState } = workerState;
  if (!playbackState) {
    // The load flow always sets up the session (StartPlayback) before any seek,
    // so this is unexpected — surface it rather than silently acknowledging.
    console.error("handleSeek: unexpected error, no playback session for seek.");
    return;
  }
  // Bump synchronously so a later seek supersedes earlier queued ones.
  const asyncId = ++playbackState.asyncId;
  seekChain = seekChain
    .then(() => runSeek({ asyncId, requestSeekId, time }))
    .catch((error) => {
      console.error("handleSeek: unexpected error.", error);
    });
};

/**
 * Performs one seek: tears down the previous iterator, opens a fresh one at
 * `time`, draws the first frame and buffers the second for handleTick. Bails
 * without drawing if superseded (`asyncId` no longer the latest). Always
 * acknowledges exactly once via SeekComplete (see the finally).
 *
 * @param params.asyncId - This seek's id, compared against the latest to detect supersession.
 * @param params.requestSeekId - Main-thread correlation id for the acknowledgment.
 * @param params.time - Target timestamp in seconds.
 */
const runSeek = async ({
  asyncId,
  requestSeekId,
  time,
}: {
  asyncId: number;
  requestSeekId: number;
  time: number;
}) => {
  try {
    const { playbackState, videoSink } = workerState;
    if (!videoSink || !playbackState) return;
    // Superseded while queued — skip without touching the decoder.
    if (asyncId !== playbackState.asyncId) return;

    const previousIterator = playbackState.iterator;
    playbackState.iterator = undefined;
    playbackState.nextFrame = undefined;
    playbackState.drawState.lastDrawnFrame = undefined;
    if (previousIterator) {
      // Fully tear down the previous iterator before opening a new one.
      await previousIterator.return().catch((error) => {
        console.error(
          "handleSeek: unexpected error while cleaning up previous iterator.",
          error,
        );
      });
    }

    const iterator = videoSink.canvases(time);
    try {
      // Prefetch two frames: draw the first immediately so the user sees the
      // seek position, then buffer the second in nextFrame for handleTick.
      const firstResult = await iterator.next();
      if (asyncId !== playbackState.asyncId || firstResult.done) {
        await cleanupIterator(iterator);
        return;
      }
      drawAndRecordFrame({
        drawState: playbackState.drawState,
        wrappedCanvas: firstResult.value,
      });

      const secondResult = await iterator.next();
      if (asyncId !== playbackState.asyncId || secondResult.done) {
        await cleanupIterator(iterator);
        return;
      }
      playbackState.iterator = iterator;
      playbackState.nextFrame = secondResult.value;
    } catch (error) {
      await cleanupIterator(iterator);
      if (asyncId !== playbackState.asyncId) return;
      self.postMessage({
        error: toError(error),
        type: PlaybackWorkerEventType.DecodeError,
      });
    }
  } finally {
    // Acknowledge exactly once, regardless of outcome. A superseded seek's
    // acknowledgment is a harmless no-op on the main thread (its id is no longer
    // pending), so correlation by seekId is all that's needed — no per-outcome
    // special-casing.
    self.postMessage({
      seekId: requestSeekId,
      type: PlaybackWorkerEventType.SeekComplete,
    });
  }
};

/**
 * Tears down the freshly-opened iterator on an early exit, logging any failure.
 *
 * @param iterator - The canvases iterator to release.
 * @returns A promise that resolves once the iterator is released.
 */
const cleanupIterator = (
  iterator: AsyncGenerator<WrappedCanvas, void, unknown>,
): Promise<unknown> =>
  iterator.return().catch((error) => {
    console.error(
      "handleSeek: unexpected error while cleaning up current iterator.",
      error,
    );
  });

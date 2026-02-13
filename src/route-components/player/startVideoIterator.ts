import { CanvasSink, WrappedCanvas } from "mediabunny";
import { RefObject } from "react";
import { IDimensions } from "../../shared/types/dimensions";
import { draw } from "./draw";
import { PlaybackClock } from "./PlaybackClock";

/**
 * Creates a new video frame iterator and renders the first video frame.
 */
export const startVideoIterator = async ({
  asyncIdRef,
  ctx,
  nextFrameRef,
  playbackClock,
  rotation,
  screenDimensions,
  videoFrameIteratorRef,
  videoSink,
}: {
  asyncIdRef: RefObject<number>;
  ctx: CanvasRenderingContext2D;
  nextFrameRef: RefObject<WrappedCanvas | undefined>;
  playbackClock: PlaybackClock;
  rotation: number;
  screenDimensions: IDimensions;
  videoFrameIteratorRef: RefObject<
    AsyncGenerator<WrappedCanvas, void, unknown> | undefined
  >;
  videoSink: CanvasSink;
}) => {
  asyncIdRef.current++;

  await videoFrameIteratorRef.current?.return(); // Dispose of the current iterator.

  // Create a new iterator.
  videoFrameIteratorRef.current = videoSink.canvases(playbackClock.currentTime);

  // Tracking performance as seeking can be a challenge for videos with sparse keyframes.
  const timeStart = Date.now();
  console.log(`startVideoIterator: requesting next two frames...`);

  // Get the first two frames.
  const firstFrame =
    (await videoFrameIteratorRef.current.next()).value ?? undefined;
  const secondFrame =
    (await videoFrameIteratorRef.current.next()).value ?? undefined;

  console.log(
    `startVideoIterator: received next two frames after ${Date.now() - timeStart}`,
  );

  nextFrameRef.current = secondFrame;

  if (firstFrame) {
    // Draw the first frame.
    console.log(
      "startVideoIterator: drawing first frame at timestamp",
      firstFrame.timestamp,
    );
    draw({
      ctx,
      rotation,
      screenDimensions,
      wrappedCanvas: firstFrame,
    });
  }
};

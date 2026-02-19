import { CanvasSink, WrappedCanvas } from "mediabunny";
import { RefObject } from "react";
import { IDimensions } from "../../shared/types/dimensions";
import { drawVideoFrame } from "./drawVideoFrame";
import { PlaybackClock } from "./PlaybackClock";

/**
 * Creates a new video frame iterator and renders the first video frame.
 *
 * @param params.asyncIdRef - Ref to track async operation validity.
 * @param params.ctx - The 2D rendering context of the target canvas.
 * @param params.flipHorizontal - Whether to flip the frame horizontally.
 * @param params.flipVertical - Whether to flip the frame vertically.
 * @param params.nextFrameRef - Ref to store the next frame for the render loop.
 * @param params.playbackClock - PlaybackClock instance for timing.
 * @param params.rotation - Rotation in radians, clockwise.
 * @param params.screenDimensions - Current screen dimensions for drawing.
 * @param params.videoFrameIteratorRef - Ref to the video frame async iterator.
 * @param params.videoSink - The CanvasSink to create a new iterator from.
 */
export const startVideoIterator = async ({
  asyncIdRef,
  ctx,
  flipHorizontal,
  flipVertical,
  nextFrameRef,
  playbackClock,
  rotation,
  screenDimensions,
  videoFrameIteratorRef,
  videoSink,
}: {
  asyncIdRef: RefObject<number>;
  ctx: CanvasRenderingContext2D;
  flipHorizontal: boolean;
  flipVertical: boolean;
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
    drawVideoFrame({
      ctx,
      flipHorizontal,
      flipVertical,
      rotation,
      screenDimensions,
      wrappedCanvas: firstFrame,
    });
  }
};

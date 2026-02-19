import { WrappedCanvas } from "mediabunny";
import { RefObject } from "react";
import { IDimensions } from "../../shared/types/dimensions";
import { drawVideoFrame } from "./drawVideoFrame";
import { PlaybackClock } from "./PlaybackClock";

/**
 * Iterates over the video frame iterator until it finds a video frame in the future.
 *
 * @param params.asyncIdRef - Ref to track async operation validity. If the value changes during
 *   iteration, the function exits early to prevent stale updates.
 * @param params.ctx - Canvas 2D rendering context.
 * @param params.flipHorizontal - Whether to flip the frame horizontally.
 * @param params.flipVertical - Whether to flip the frame vertically.
 * @param params.nextFrameRef - Ref to store the next frame for the render loop.
 * @param params.playbackClock - PlaybackClock instance for timing.
 * @param params.rotation - Rotation in radians, clockwise.
 * @param params.screenDimensions - Current screen dimensions for drawing.
 * @param params.videoFrameIterator - The video frame async iterator to read from.
 */
export const updateNextFrame = async ({
  asyncIdRef,
  ctx,
  flipHorizontal,
  flipVertical,
  nextFrameRef,
  playbackClock,
  rotation,
  screenDimensions,
  videoFrameIterator,
}: {
  asyncIdRef: RefObject<number>;
  ctx: CanvasRenderingContext2D;
  flipHorizontal: boolean;
  flipVertical: boolean;
  nextFrameRef: RefObject<WrappedCanvas | undefined>;
  playbackClock: PlaybackClock;
  rotation: number;
  screenDimensions: IDimensions;
  videoFrameIterator: AsyncGenerator<WrappedCanvas, void, unknown> | undefined;
}) => {
  if (!videoFrameIterator) {
    console.error("updateNextFrame: videoFrameIterator not initialized.");
    return;
  }

  const currentAsyncId = asyncIdRef.current;

  // We have a loop here because we may need to iterate over multiple frames until we reach a frame in the future.
  while (true) {
    const newNextFrame = (await videoFrameIterator.next()).value;
    if (!newNextFrame) {
      break;
    }

    if (currentAsyncId !== asyncIdRef.current) {
      break;
    }

    const playbackTime = playbackClock.currentTime;
    if (newNextFrame.timestamp <= playbackTime) {
      // Draw it immediately.
      // console.log(
      //   `updateNextFrame: drawing frame at ${newNextFrame.timestamp}, playbackTime = ${playbackTime}`,
      // );
      drawVideoFrame({
        ctx,
        flipHorizontal,
        flipVertical,
        rotation,
        screenDimensions,
        wrappedCanvas: newNextFrame,
      });
    } else {
      // console.log(
      //   `updateNextFrame: fetched next frame at ${newNextFrame.timestamp}, playbackTime = ${playbackTime}`,
      // );
      // Save it for later.
      nextFrameRef.current = newNextFrame;
      break;
    }
  }
};

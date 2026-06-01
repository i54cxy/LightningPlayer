import { FC, useEffect, useRef } from "react";
import { formatTimestamp } from "../../../shared/utils/formatTimestamp";
import { Tooltip } from "../tooltip/Tooltip";
import {
  containerStyles,
  loadingDotStyles,
  loadingOverlayStyles,
  placeholderStyles,
  thumbnailStyles,
  tooltipStyles,
} from "./PreviewThumbnail.styles";
import {
  previewThumbnailHeight,
  previewThumbnailWidth,
} from "./PreviewThumbnail.types";

export interface IPreviewThumbnailProps {
  /**
   * Returns the pre-decoded thumbnail bitmap for the timestamp, or undefined if
   * not cached. A pure in-memory lookup (no decode).
   *
   * @param timestamp in seconds.
   */
  getThumbnail: (timestamp: number) => ImageBitmap | undefined;
  /**
   * timestamp in seconds.
   */
  timestamp: number;
}

export const PreviewThumbnail: FC<IPreviewThumbnailProps> = ({
  getThumbnail,
  timestamp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roundedTimestamp = Math.round(timestamp);
  // Pure memory lookup; the cache returns the same bitmap object per timestamp,
  // so the effect below only redraws when the timestamp actually changes.
  const bitmap = getThumbnail(roundedTimestamp);

  // Draw the cached bitmap (or clear, so the placeholder shows when absent).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, previewThumbnailWidth, previewThumbnailHeight);
    if (bitmap) {
      // The bitmap is already scaled to fit; draw it centered in the fixed box.
      ctx.drawImage(
        bitmap,
        (previewThumbnailWidth - bitmap.width) / 2,
        (previewThumbnailHeight - bitmap.height) / 2,
      );
    }
  }, [bitmap]);

  const hasThumbnail = bitmap !== undefined;

  return (
    <Tooltip
      showTooltip={true}
      text={formatTimestamp(roundedTimestamp)}
      tooltipStylesOverride={tooltipStyles}
    >
      <div css={containerStyles}>
        <div css={placeholderStyles} data-initialized={hasThumbnail} />
        <canvas
          css={thumbnailStyles}
          height={previewThumbnailHeight}
          ref={canvasRef}
          width={previewThumbnailWidth}
        />
        <div css={loadingOverlayStyles} data-loading={!hasThumbnail}>
          <div css={loadingDotStyles} />
          <div css={loadingDotStyles} />
          <div css={loadingDotStyles} />
        </div>
      </div>
    </Tooltip>
  );
};

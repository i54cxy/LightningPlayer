import { FC, useCallback, useRef, useState } from "react";
import {
  IDebouncedEffectCallbackParams,
  useDebouncedEffect,
} from "../../../shared/hooks/useDebouncedEffect";
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

export interface IPreviewThumbnailProps {
  /**
   * Fetches thumbnail URL for timestamp. Returns cached URL immediately if available. Can be expensive.
   *
   * @param timestamp in seconds.
   */
  getThumbnail: (timestamp: number) => Promise<string | undefined>;
  /**
   * timestamp in seconds.
   */
  timestamp: number;
}

const THUMBNAIL_DEBOUNCE_MS = 100;

export const PreviewThumbnail: FC<IPreviewThumbnailProps> = ({
  getThumbnail,
  timestamp,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  // An non-undefined currentThumbnailTimestamp also means there's at least
  // one image available to render.
  const [currentThumbnailTimestamp, setCurrentThumbnailTimestamp] = useState<
    number | undefined
  >(undefined);
  const roundedTimestamp = Math.round(timestamp);

  // Fetch thumbnail when timestamp changes, debounced so only the last
  // request in a rapid sequence actually triggers a fetch.
  const fetchThumbnail = useCallback(
    ({ cancelled }: IDebouncedEffectCallbackParams) => {
      const fetch = async () => {
        if (cancelled) {
          return;
        }

        const url = await getThumbnail(roundedTimestamp);

        if (cancelled) {
          return;
        }

        if (url && imgRef.current) {
          // Update img src imperatively - no React state delay.
          imgRef.current.src = url;
          imgRef.current.onload = () => {
            setCurrentThumbnailTimestamp(roundedTimestamp);
          };
        }
      };
      fetch();
    },
    [getThumbnail, roundedTimestamp],
  );

  useDebouncedEffect(fetchThumbnail, THUMBNAIL_DEBOUNCE_MS);

  const handleError = () => {
    setCurrentThumbnailTimestamp(undefined);
  };

  const isLoading = currentThumbnailTimestamp !== roundedTimestamp;

  return (
    <Tooltip
      showTooltip={true}
      text={formatTimestamp(roundedTimestamp)}
      tooltipStylesOverride={tooltipStyles}
    >
      <div css={containerStyles}>
        <div
          css={placeholderStyles}
          data-initialized={currentThumbnailTimestamp !== undefined}
        />
        <img
          alt="Preview"
          css={thumbnailStyles}
          onError={handleError}
          ref={imgRef}
        />
        <div css={loadingOverlayStyles} data-loading={isLoading}>
          <div css={loadingDotStyles} />
          <div css={loadingDotStyles} />
          <div css={loadingDotStyles} />
        </div>
      </div>
    </Tooltip>
  );
};

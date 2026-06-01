import { atom } from "jotai";

/**
 * Whether preview thumbnails are enabled. Defaults to true; the user can toggle
 * it from the Dev Tools "Show Preview" item. Gates the preview thumbnail UI and
 * drives the thumbnail prefetch (the thumbnail worker fills the cache while this
 * is on and there is a video file loaded).
 */
export const enablePreviewThumbnailsState = atom(true);

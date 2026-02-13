import { atomWithStorage } from "jotai/utils";

/** Whether the video is flipped vertically. */
export const flipVerticalState = atomWithStorage("flipVertical", false);

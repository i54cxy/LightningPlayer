import { atomWithStorage } from "jotai/utils";

/** Whether the video is flipped horizontally. */
export const flipHorizontalState = atomWithStorage("flipHorizontal", false);

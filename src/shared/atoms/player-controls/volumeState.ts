import { atomWithStorage } from "jotai/utils";

/** Volume ranges from 0 to 1. */
export const volumeState = atomWithStorage("volume", 1);

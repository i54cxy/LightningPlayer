import { atomWithStorage } from "jotai/utils";

/** Playback speed multiplier. 1 means normal speed. */
export const playbackSpeedState = atomWithStorage("playbackSpeed", 1);

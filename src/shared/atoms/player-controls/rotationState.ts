import { atomWithStorage } from "jotai/utils";

/** Rotation in radians, clockwise. */
export const rotationState = atomWithStorage("rotation", 0);

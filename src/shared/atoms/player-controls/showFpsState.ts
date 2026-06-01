import { atomWithStorage } from "jotai/utils";

/** Whether the developer FPS readout is shown over the player. */
export const showFpsState = atomWithStorage("showFps", true);

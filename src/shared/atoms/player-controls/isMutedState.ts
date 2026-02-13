import { atomWithStorage } from "jotai/utils";

export const isMutedState = atomWithStorage("isMuted", false);

import { atom } from "jotai";

/** Transient message displayed over the player canvas (e.g. audio visualization info). */
export const playbackMessageState = atom<string | undefined>(undefined);

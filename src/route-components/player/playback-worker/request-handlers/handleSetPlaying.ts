import {
  PlaybackWorkerRequest,
  PlaybackWorkerRequestType,
} from "../playbackWorker.types";
import { workerState } from "../workerState";

export const handleSetPlaying = ({
  isPlaying,
}: Extract<
  PlaybackWorkerRequest,
  { type: PlaybackWorkerRequestType.SetPlaying }
>) => {
  if (!workerState.playbackState) return;
  workerState.playbackState.isPlaying = isPlaying;
};

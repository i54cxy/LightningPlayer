import {
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "../decodeWorker.types";
import { workerState } from "../workerState";

export const handleSetPlaying = ({
  isPlaying,
}: Extract<
  DecodeWorkerRequest,
  { type: DecodeWorkerRequestType.SetPlaying }
>) => {
  if (!workerState.playbackState) return;
  workerState.playbackState.isPlaying = isPlaying;
};

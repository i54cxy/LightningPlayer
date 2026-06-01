/// <reference lib="webworker" />

import {
  PlaybackWorkerRequest,
  PlaybackWorkerRequestType,
} from "./playbackWorker.types";
import { handleLoadFile } from "./request-handlers/handleLoadFile";
import { handleSeek } from "./request-handlers/handleSeek";
import { handleSetPlaying } from "./request-handlers/handleSetPlaying";
import { handleStartPlayback } from "./request-handlers/handleStartPlayback";
import { handleTick } from "./request-handlers/handleTick";
import { handleUpdateDrawParams } from "./request-handlers/handleUpdateDrawParams";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<PlaybackWorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case PlaybackWorkerRequestType.LoadFile:
      void handleLoadFile(request);
      break;
    case PlaybackWorkerRequestType.StartPlayback:
      handleStartPlayback(request);
      break;
    case PlaybackWorkerRequestType.Seek:
      void handleSeek(request);
      break;
    case PlaybackWorkerRequestType.SetPlaying:
      handleSetPlaying(request);
      break;
    case PlaybackWorkerRequestType.Tick:
      void handleTick(request);
      break;
    case PlaybackWorkerRequestType.UpdateDrawParams:
      handleUpdateDrawParams(request);
      break;
  }
};

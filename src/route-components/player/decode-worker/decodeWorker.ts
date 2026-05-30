/// <reference lib="webworker" />

import {
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "./decodeWorker.types";
import { handleGetThumbnail } from "./request-handlers/handleGetThumbnail";
import { handleLoadFile } from "./request-handlers/handleLoadFile";
import { handleProbe } from "./request-handlers/handleProbe";
import { handleSeek } from "./request-handlers/handleSeek";
import { handleSetPlaying } from "./request-handlers/handleSetPlaying";
import { handleStartPlayback } from "./request-handlers/handleStartPlayback";
import { handleTick } from "./request-handlers/handleTick";
import { handleUpdateDrawParams } from "./request-handlers/handleUpdateDrawParams";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<DecodeWorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case DecodeWorkerRequestType.GetThumbnail:
      void handleGetThumbnail(request);
      break;
    case DecodeWorkerRequestType.LoadFile:
      void handleLoadFile(request);
      break;
    case DecodeWorkerRequestType.Probe:
      void handleProbe(request);
      break;
    case DecodeWorkerRequestType.StartPlayback:
      handleStartPlayback(request);
      break;
    case DecodeWorkerRequestType.Seek:
      void handleSeek(request);
      break;
    case DecodeWorkerRequestType.SetPlaying:
      handleSetPlaying(request);
      break;
    case DecodeWorkerRequestType.Tick:
      void handleTick(request);
      break;
    case DecodeWorkerRequestType.UpdateDrawParams:
      handleUpdateDrawParams(request);
      break;
  }
};

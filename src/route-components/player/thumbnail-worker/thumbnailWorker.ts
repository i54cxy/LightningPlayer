/// <reference lib="webworker" />

import { handleFillThumbnails } from "./request-handlers/handleFillThumbnails";
import { handleLoadFile } from "./request-handlers/handleLoadFile";
import {
  ThumbnailWorkerRequest,
  ThumbnailWorkerRequestType,
} from "./thumbnailWorker.types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<ThumbnailWorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case ThumbnailWorkerRequestType.FillThumbnails:
      void handleFillThumbnails(request);
      break;
    case ThumbnailWorkerRequestType.LoadFile:
      void handleLoadFile(request);
      break;
  }
};

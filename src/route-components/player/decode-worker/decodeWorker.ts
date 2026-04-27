/// <reference lib="webworker" />

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import {
  DecodeWorkerEvent,
  DecodeWorkerEventType,
  DecodeWorkerRequest,
  DecodeWorkerRequestType,
} from "./decodeWorker.types";

declare const self: DedicatedWorkerGlobalScope;

// Module-level state for this worker instance. The manager spawns one worker
// per probe call and terminates it at the end, so this state is effectively
// per-probe-call.
let cachedSink: CanvasSink | undefined;

const post = (event: DecodeWorkerEvent) => {
  self.postMessage(event);
};

/**
 * Opens the Input from the blob and constructs a CanvasSink for the chosen
 * video track. Subsequent Probe requests reuse the same sink.
 */
const handleInit = async (
  request: Extract<DecodeWorkerRequest, { type: DecodeWorkerRequestType.Init }>,
) => {
  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(request.blob),
    });
    const allTracks = await input.getTracks();
    const videoTrack = allTracks[request.videoTrackIndex];
    if (!videoTrack || !videoTrack.isVideoTrack()) {
      throw new Error(
        `Track at index ${request.videoTrackIndex} is not a video track.`,
      );
    }
    cachedSink = new CanvasSink(videoTrack, { fit: "contain" });
    post({ type: DecodeWorkerEventType.InitComplete });
  } catch (error) {
    post({
      error: error instanceof Error ? error : new Error(String(error)),
      type: DecodeWorkerEventType.InitError,
    });
  }
};

/**
 * Decodes a single frame at the given timestamp and posts back the wall-clock
 * decode duration in milliseconds.
 */
const handleProbe = async (
  request: Extract<
    DecodeWorkerRequest,
    { type: DecodeWorkerRequestType.Probe }
  >,
) => {
  try {
    if (!cachedSink) {
      throw new Error("Worker not initialized.");
    }
    const startTime = performance.now();
    await cachedSink.getCanvas(request.timestamp);
    const durationMs = performance.now() - startTime;
    post({ durationMs, type: DecodeWorkerEventType.ProbeResult });
  } catch (error) {
    post({
      error: error instanceof Error ? error : new Error(String(error)),
      type: DecodeWorkerEventType.ProbeError,
    });
  }
};

self.onmessage = (event: MessageEvent<DecodeWorkerRequest>) => {
  const request = event.data;
  if (request.type === DecodeWorkerRequestType.Init) {
    void handleInit(request);
  } else if (request.type === DecodeWorkerRequestType.Probe) {
    void handleProbe(request);
  }
};

export enum DecodeWorkerRequestType {
  Init = "Init",
  Probe = "Probe",
}

export enum DecodeWorkerEventType {
  InitComplete = "InitComplete",
  InitError = "InitError",
  ProbeError = "ProbeError",
  ProbeResult = "ProbeResult",
}

/**
 * Message sent from the main thread to the decode worker.
 * Discriminated union; future operations (e.g. getThumbnail, getPlaybackFrame)
 * are added here as new variants.
 */
export type DecodeWorkerRequest =
  | { blob: Blob; type: DecodeWorkerRequestType.Init; videoTrackIndex: number }
  | { timestamp: number; type: DecodeWorkerRequestType.Probe };

/**
 * Message sent from the decode worker to the main thread.
 * Discriminated union; each request has exactly one corresponding event in
 * either its success or its error variant.
 */
export type DecodeWorkerEvent =
  | { type: DecodeWorkerEventType.InitComplete }
  | { error: Error; type: DecodeWorkerEventType.InitError }
  | { error: Error; type: DecodeWorkerEventType.ProbeError }
  | { durationMs: number; type: DecodeWorkerEventType.ProbeResult };

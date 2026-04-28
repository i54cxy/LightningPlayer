import { IDimensions } from "../../../shared/types/dimensions";

export enum DecodeWorkerRequestType {
  LoadFile = "LoadFile",
  Probe = "Probe",
  Reset = "Reset",
  Seek = "Seek",
  SetPlaying = "SetPlaying",
  StartPlayback = "StartPlayback",
  Tick = "Tick",
  UpdateDrawParams = "UpdateDrawParams",
}

export enum DecodeWorkerEventType {
  DecodeError = "DecodeError",
  EndOfStream = "EndOfStream",
  LoadFileComplete = "LoadFileComplete",
  LoadFileError = "LoadFileError",
  ProbeError = "ProbeError",
  ProbeResult = "ProbeResult",
  StartPlaybackComplete = "StartPlaybackComplete",
  StartPlaybackError = "StartPlaybackError",
}

/**
 * Transform + screen dimensions used to render each video frame to the
 * worker's offscreen canvas. The `ctx` field is owned by the worker and
 * never serialized over postMessage.
 */
export interface IPlaybackDrawParams {
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: number;
  screenDimensions: IDimensions;
}

/**
 * Message sent from the main thread to the decode worker.
 * Discriminated union covering both the one-shot probe RPC and the streaming
 * playback session.
 */
export type DecodeWorkerRequest =
  | { blob: Blob; type: DecodeWorkerRequestType.LoadFile; videoTrackIndex: number }
  | { timestamp: number; type: DecodeWorkerRequestType.Probe }
  | {
      drawParams: IPlaybackDrawParams;
      offscreenCanvas: OffscreenCanvas;
      type: DecodeWorkerRequestType.StartPlayback;
    }
  | { time: number; type: DecodeWorkerRequestType.Seek }
  | { isPlaying: boolean; type: DecodeWorkerRequestType.SetPlaying }
  | { currentTime: number; type: DecodeWorkerRequestType.Tick }
  | {
      partial: Partial<IPlaybackDrawParams>;
      type: DecodeWorkerRequestType.UpdateDrawParams;
    }
  | { type: DecodeWorkerRequestType.Reset };

/**
 * Message sent from the decode worker to the main thread.
 * Each RPC-shaped request has a success and an error variant; the streaming
 * session emits EndOfStream on iterator exhaustion and DecodeError on failure.
 */
export type DecodeWorkerEvent =
  | { type: DecodeWorkerEventType.LoadFileComplete }
  | { error: Error; type: DecodeWorkerEventType.LoadFileError }
  | { error: Error; type: DecodeWorkerEventType.ProbeError }
  | { durationMs: number; type: DecodeWorkerEventType.ProbeResult }
  | { type: DecodeWorkerEventType.StartPlaybackComplete }
  | { error: Error; type: DecodeWorkerEventType.StartPlaybackError }
  | { type: DecodeWorkerEventType.EndOfStream }
  | { error: Error; type: DecodeWorkerEventType.DecodeError };

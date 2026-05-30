import { IDimensions } from "../../../shared/types/dimensions";

export enum DecodeWorkerRequestType {
  GetThumbnail = "GetThumbnail",
  LoadFile = "LoadFile",
  Probe = "Probe",
  Seek = "Seek",
  SetPlaying = "SetPlaying",
  StartPlayback = "StartPlayback",
  Tick = "Tick",
  UpdateDrawParams = "UpdateDrawParams",
}

export enum DecodeWorkerEventType {
  DecodeError = "DecodeError",
  GetThumbnailError = "GetThumbnailError",
  GetThumbnailResult = "GetThumbnailResult",
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
  | { requestId: number; timestamp: number; type: DecodeWorkerRequestType.GetThumbnail }
  | { blob: Blob; type: DecodeWorkerRequestType.LoadFile; videoTrackIndex: number }
  | { timestamp: number; type: DecodeWorkerRequestType.Probe }
  | { time: number; type: DecodeWorkerRequestType.Seek }
  | { isPlaying: boolean; type: DecodeWorkerRequestType.SetPlaying }
  | {
      drawParams: IPlaybackDrawParams;
      offscreenCanvas: OffscreenCanvas;
      type: DecodeWorkerRequestType.StartPlayback;
    }
  | { currentTime: number; type: DecodeWorkerRequestType.Tick }
  | {
      partial: Partial<IPlaybackDrawParams>;
      type: DecodeWorkerRequestType.UpdateDrawParams;
    };

/**
 * Message sent from the decode worker to the main thread.
 * Each RPC-shaped request has a success and an error variant; the streaming
 * session emits DecodeError on failure.
 */
export type DecodeWorkerEvent =
  | { error: Error; type: DecodeWorkerEventType.DecodeError }
  | { error: Error; requestId: number; type: DecodeWorkerEventType.GetThumbnailError }
  | { blob: Blob; requestId: number; type: DecodeWorkerEventType.GetThumbnailResult }
  | { type: DecodeWorkerEventType.LoadFileComplete }
  | { error: Error; type: DecodeWorkerEventType.LoadFileError }
  | { error: Error; type: DecodeWorkerEventType.ProbeError }
  | { durationMs: number; type: DecodeWorkerEventType.ProbeResult }
  | { type: DecodeWorkerEventType.StartPlaybackComplete }
  | { error: Error; type: DecodeWorkerEventType.StartPlaybackError };

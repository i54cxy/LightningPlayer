import { IDimensions } from "../../../shared/types/dimensions";

export enum PlaybackWorkerRequestType {
  LoadFile = "LoadFile",
  Seek = "Seek",
  SetPlaying = "SetPlaying",
  StartPlayback = "StartPlayback",
  Tick = "Tick",
  UpdateDrawParams = "UpdateDrawParams",
}

export enum PlaybackWorkerEventType {
  DecodedFrameRate = "DecodedFrameRate",
  DecodeError = "DecodeError",
  LoadFileComplete = "LoadFileComplete",
  LoadFileError = "LoadFileError",
  SeekComplete = "SeekComplete",
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
 * Message sent from the main thread to the playback worker. Covers the one-shot
 * probe RPC and the streaming playback session.
 */
export type PlaybackWorkerRequest =
  | { blob: Blob; type: PlaybackWorkerRequestType.LoadFile; videoTrackIndex: number }
  | { seekId: number; time: number; type: PlaybackWorkerRequestType.Seek }
  | { isPlaying: boolean; type: PlaybackWorkerRequestType.SetPlaying }
  | {
      drawParams: IPlaybackDrawParams;
      offscreenCanvas: OffscreenCanvas;
      type: PlaybackWorkerRequestType.StartPlayback;
    }
  | { currentTime: number; type: PlaybackWorkerRequestType.Tick }
  | {
      partial: Partial<IPlaybackDrawParams>;
      type: PlaybackWorkerRequestType.UpdateDrawParams;
    };

/**
 * Message sent from the playback worker to the main thread. Each RPC-shaped
 * request has a success and an error variant; the streaming session emits
 * DecodedFrameRate periodically and DecodeError on failure.
 */
export type PlaybackWorkerEvent =
  | { fps: number; type: PlaybackWorkerEventType.DecodedFrameRate }
  | { error: Error; type: PlaybackWorkerEventType.DecodeError }
  | { type: PlaybackWorkerEventType.LoadFileComplete }
  | { error: Error; type: PlaybackWorkerEventType.LoadFileError }
  | { seekId: number; type: PlaybackWorkerEventType.SeekComplete }
  | { type: PlaybackWorkerEventType.StartPlaybackComplete }
  | { error: Error; type: PlaybackWorkerEventType.StartPlaybackError };

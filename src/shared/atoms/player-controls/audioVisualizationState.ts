import { atomWithStorage } from "jotai/utils";

export enum AudioVisualization {
  Off = "Off",
  WaveformRealTime = "WaveformRealTime",
}

export const audioVisualizationState = atomWithStorage<AudioVisualization>(
  "audioVisualization",
  AudioVisualization.Off,
);

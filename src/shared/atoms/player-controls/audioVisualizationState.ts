import { atomWithStorage } from "jotai/utils";

export enum AudioVisualization {
  FrequencyRealTime = "FrequencyRealTime",
  Off = "Off",
  WaveformRealTime = "WaveformRealTime",
}

export const audioVisualizationState = atomWithStorage<AudioVisualization>(
  "audioVisualization",
  AudioVisualization.Off,
);

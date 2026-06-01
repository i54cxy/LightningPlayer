/** Progress bar current fill element ID for imperative DOM updates. */
export const progressBarCurrentId = "progress-bar-current";

/** Progress bar thumb element ID for imperative DOM updates. */
export const progressBarThumbId = "progress-bar-thumb";

/** Preview-thumbnail fill-progress shade element ID for imperative DOM updates. */
export const progressBarThumbnailProgressId = "progress-bar-thumbnail-progress";

export enum PlayerControlElement {
  AudioTrackButton = "AudioTrackButton",
  FullscreenButton = "FullscreenButton",
  Overlay = "Overlay",
  PlayButton = "PlayButton",
  ProgressBar = "ProgressBar",
  SettingsButton = "SettingsButton",
  Timestamp = "Timestamp",
  VolumeControl = "VolumeControl",
}
/** Duration in milliseconds before the overlay auto-hides due to mouse inactivity. */
export const IDLE_TIMEOUT_MS = 3000;

export const playerControlButtonContainerHeight = 40;
export const playerControlButtonContainerMarginTop = 8;

// True only for debugging purposes.
export const ALWAYS_SHOW_OVERLAY: boolean = false;

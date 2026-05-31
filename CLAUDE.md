# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lightning Player is a Tauri v2 desktop media player built with:

- **Frontend**: React 19 + TypeScript + Vite + Emotion (CSS-in-JS)
- **Backend**: Rust (Tauri)
- **State Management**: Jotai
- **Routing**: React Router v7
- **Media Processing**: mediabunny library for video decoding and playback

## Commands

```powershell
pnpm tauri dev     # Development (Vite + Tauri together)
pnpm dev           # Frontend only (Vite at localhost:3420)
pnpm build         # Build frontend (tsc + vite build)
pnpm tauri build   # Production build
pnpm lint          # ESLint
```

## Architecture

### Frontend (`src/`)

- **Entry**: `src/main.tsx` - React Router setup
- **Routes** (`src/route-components/routes.ts`):
  - `/` → Home - File picker UI
  - `/player` → Player - Canvas-based video playback

### Backend (`src-tauri/src/`)

- `lib.rs` - Tauri plugins (shell, fs, dialog, opener) and command handler setup

## Conventions

### Naming

- Interfaces should start with the upper case I: e.g. `IDimensions`.
- Interfaces for component props should end with `Props` e.g. `IButtonProps`.
- Enums and their keys should use upper camel case: e.g. `ButtonVariant.Text`, or upper snake case for numeric and string constants: e.g. `ZIndex.TITLE_BAR`.
- In `.styles.` files, css styles should have the suffix `Styles`; use `container` instead of `wrapper`. E.g. `buttonContainerStyles`.

### File Naming and Structure

- `Component.tsx` - React component (keep the component prop's type definition here)
- `Component.styles.[ts|tsx]` - Emotion styles, constants used by styles
- `Component.types.ts` - Other TypeScript interfaces, constants, and types

UI components in `src/ui-components/`:

- `base/` - Primitives (Button, TitleBar, ResizableWindow, FullscreenContainer)
- `level-one/` - Composed components (VolumeControl, TitleBar)
- `level-two/` - Higher-order composed components (PlayerControlOverlay)
- Each level imports from components from lower levels, and not the other way around.

### Updating Theme

- Add new fields to `src/themes/emoton.d.ts`.
- Update each theme configuration (`dark-default.json`, etc.).
- Access via Emotion's `useTheme()` or `css` prop with `(theme: Theme) => css({...`.

### Coding Style

#### Implementation

- Avoid using null as much as possible.

- Avoid hard casting as much as possible.

- When running ESLint to check for errors, simply run `pnpm lint` - no need for `cd` or other params.

- All fields in objects, types, interfaces, enums, and function parameters are alphanumerically sorted. When doing this in styles files, CSS selectors (like &:hover, [data-...]) need to be kept at the end and retain their original order to preserve cascade behavior.

- When writing functions, if we need multiple parameters, put the parameters in a single object and type it inline in the function signature.

- A file containing only one function should use the exact same name as the function. A file should define at most one React component. A file containing a react component should use the exact same name as the component.

- When initializing a react ref, only use null when the ref is pointing to an HTML element; for all other cases, use undefined to represent an unset value.

- Only pass refs to a function when the function updates the ref (i.e. ref.current = ...) otherwise pass the ref.current directly.

- For the unmount/cancel flag in useEffects, always name the flag `cancelled` e.g. `let cancelled = false; ... if (!cancelled) // do stuff ... return () => { cancelled = true; }`.

- Avoid using inline functions in JSX. Declare them outside of the render/return.

- When creating enums, use values the same as the keys by default.

- Avoid using `transform: scale()` on text elements as it causes blurring during the transition.

#### Documentation

- Always end comment sentences with a period.

- Always write TSDoc style function headers for functions - include the @param and @returns tags when applicable.

- When debugging or making changes, keep debug comments such as `console.log` or at least comment them out instead of removing them.

## Implementation Notes

### Root (`src/route-components/root/Root.tsx`)

Provides Emotion ThemeProvider, global styles, and Tauri-specific components (TitleBar, DragAndDropOverlay) conditionally rendered via `isTauri()`.

### Player (`src/route-components/player/Player.tsx`)

#### Summary

Supports both video and audio-only playback using mediabunny for decoding and Web Audio API for audio:

1. Creates `Input` from file blob with `BlobSource`.
2. Gets all tracks via `getTracks()`, filters by `canDecode()`, then separates into video and audio tracks.
3. If no decodable tracks exist, throws an error (current playback is preserved).
4. Creates `DecodeWorkerManager` for video decoding in a Web Worker (only when video tracks exist) and `AudioBufferSink` for audio buffers. Thumbnail decoding also runs in the worker via the `GetThumbnail` RPC.
5. Audio: Schedules `AudioBufferSourceNode` instances via `runAudioIterator`.
6. Video: The decode worker renders frames to an `OffscreenCanvas` (transferred from the main thread on the first file load). The main thread drives the worker via `tick(currentTime)` calls on every `requestAnimationFrame`.

A `hasVideo` state tracks whether the current file has video tracks. When `false`: the decode worker, thumbnail cache, and preview thumbnails are skipped; `seekImpl` updates only the clock and progress bar; duration is computed from the selected audio track (and recomputed on audio track switch); preview thumbnails and flip/rotate settings are hidden in the UI.

An `isFileLoaded` state controls `PlayerControlOverlay` visibility. It is set to `false` at the start of every load (unmounting the overlay so the user cannot interact with stale controls) and to `true` in the final state-update batch after all async work completes.

An `isPreviewThumbnailEnabled` state gates preview thumbnail UI. It is set to `true` only after a decode performance probe (`getIsPreviewThumbnailEnabled`) confirms the file can decode frames quickly enough for interactive seeking — both per-frame (under 1s) and on average (under 250ms).

#### PlaybackClock (`src/route-components/player/PlaybackClock.ts`)

Manages playback timing using `AudioContext` as the master clock for A/V sync:

- `timestampAtPlayStart`: The video timestamp we're measuring from (set on play/pause/seek).
- `audioContextTimeAtPlayStart`: The `AudioContext.currentTime` when `play()` was called.
- `currentTime`: Returns `timestampAtPlayStart + (audioContext.currentTime - audioContextTimeAtPlayStart)` when playing, or just `timestampAtPlayStart` when paused.

Both audio and video playback rely on `PlaybackClock.currentTime` to achieve synchronized play, pause, and seek.

#### Decode worker (`src/route-components/player/decode-worker/`)

Video decoding and rendering runs in a dedicated Web Worker to keep the main thread free for UI interaction.

**DecodeWorkerManager (`DecodeWorkerManager.ts`)**: Main-thread wrapper. Constructed once per Player mount and persists for its lifetime, but recycles its underlying worker per file via `terminateWorker()`. Key methods:

- `loadFile(blob, videoTrackIndex)` — opens the file in the worker, constructs a playback `CanvasSink` (with `poolSize: 2`) and a separate `thumbnailSink` for thumbnail decoding.
- `probe(timestamp, timeoutMs)` — decodes a single frame and returns wall-clock duration. If the decode exceeds the timeout, the hung worker is terminated and a fresh one is transparently spun up re-loaded to the same file. Rejects all pending thumbnail requests before terminating.
- `getThumbnail(timestamp)` — decodes a single frame at the given timestamp using the `thumbnailSink`, resizes to thumbnail dimensions via `OffscreenCanvas`, encodes to JPEG, and returns the blob. Concurrent requests are correlated by `requestId`.
- `startPlayback(canvasElement, drawParams)` — transfers the `<canvas>` to the current worker via `transferControlToOffscreen()`; a no-op if that worker already received a canvas (the offscreen canvas cannot be re-transferred). Because the worker is recycled per file by `terminateWorker()`, each file's fresh worker is given a fresh, never-transferred `<canvas>` element (remounted in `Player.tsx` via a per-file key).
- `seek(time)` — creates a new frame iterator at the given timestamp, draws the first frame, and buffers the second for tick-driven rendering.
- `tick(currentTime)` — draws the buffered next frame if its timestamp has been reached and pre-fetches one more. Processes at most one frame per call.
- `updateDrawParams(partial)` — merges flip/rotation/screen-dimension changes and re-draws the last frame.
- `terminateWorker()` — terminates the current worker (instantly stopping any in-flight decode on its thread) and spawns a fresh idle replacement with no file loaded and no canvas transferred. The single place workers are recycled; used both on file switch and to recover a hung worker on probe timeout.
- `dispose()` — terminates the worker permanently; called on Player unmount.

**workerState (`workerState.ts`)**: Module-level mutable state, one set per worker instance. `videoSink` and `thumbnailSink` are set on `LoadFile`, `playbackState` on `StartPlayback`. Since the worker is terminated and respawned per file, this state starts fresh for every file.

**drawAndRecordFrame (`utils/drawAndRecordFrame.ts`)**: Draws a `WrappedCanvas` to the offscreen canvas with flip/rotation transforms and records it as `lastDrawnFrame` for later re-draws on transform/resize changes.

#### Video playback

The main-thread render loop calls `decodeManagerRef.current.tick(playbackTime)` on every `requestAnimationFrame`. The worker draws the buffered next frame if its timestamp has been reached and asynchronously pre-fetches the following frame. On seek, the worker creates a fresh iterator, draws the first frame immediately, and buffers the second.

**Render loop** (in `Player.tsx`): A `requestAnimationFrame` loop that:

1. Gets current playback time from `PlaybackClock.currentTime`.
2. Calls `decodeManagerRef.current.tick(playbackTime)` to drive the worker's frame rendering.
3. Updates the progress bar and timestamp DOM imperatively via `updateProgressBarDOM` and `updateTimestampDOM`.

#### Audio playback (`src/route-components/player/audio/runAudioIterator.ts`)

Schedules audio buffers using Web Audio API:

1. Iterates over `AudioBufferSink.buffers(time)`.
2. For each buffer, creates `AudioBufferSourceNode` and connects to `GainNode`.
3. Schedules playback:
   - Future buffers: `node.start(audioContextTimeAtPlayStart + timestamp - timestampAtPlayStart)`.
   - Past buffers (partially elapsed): `node.start(audioContext.currentTime, offset)`.
4. Throttles when >1 second buffered ahead.
5. Tracks scheduled nodes in `queuedAudioNodes` Set (added after `start()`, removed on `ended`).

**Cleanup (`cleanupPlayback`):** Pauses the clock, stops all nodes in `queuedAudioNodes` via `node.stop()`, releases the audio iterator via `.return()`, and resets the thumbnail cache. The decode worker is recycled separately: the file-load effect cleanup calls `decodeManagerRef.current.terminateWorker()`, which terminates the current worker (instantly stopping the old file's decode) and spawns a fresh one for the next file. The `DecodeWorkerManager` itself persists for the Player's lifetime and is disposed on unmount.

#### Audio visualization

The visualization canvas (`audioVisualizationCanvasRef`) is a separate full-screen `<canvas>` overlaid on top of the video canvas with `pointerEvents: none`. Its visibility is controlled by the `data-visible` attribute, which is set from the `audioVisualization` atom (`src/shared/atoms/player-controls/audioVisualizationState.ts`).

**Modes (`AudioVisualization` enum):**

- `WaveformRealTime` — oscilloscope drawn by `drawAudioWaveform` (`src/route-components/player/audio-visualization/drawAudioWaveform.ts`). Uses `getByteTimeDomainData`. Stroke is a vertical gradient: red at the top and bottom edges (peak amplitude) transitioning to blue at the centre line (silence).
- `FrequencyRealTime` — spectrum analyser drawn by `drawAudioFrequencyBars` (`src/route-components/player/audio-visualization/drawAudioFrequencyBars.ts`). Uses `getByteFrequencyData`. 80 bars mapped on a logarithmic frequency scale (20 Hz–Nyquist). Bar height is capped at 90% of canvas height. Fill is a vertical gradient: blue at the bottom (quiet) → violet → orange-red at the top (loud).
- `OverviewWaveform` — full-file scrolling waveform drawn by `drawWaveformOverview` (`src/route-components/player/audio-visualization/drawWaveformOverview.ts`). See "Waveform overview" section below.
- `Off` — canvas is hidden.

**AnalyserNode pipeline:**

```
AudioBufferSourceNode → GainNode → AnalyserNode → AudioContext.destination
```

`fftSize` is set to `AUDIO_ANALYSER_FFT_SIZE` (4096), giving `frequencyBinCount` = 2048 and a time window of ~93 ms at 44.1 kHz. The window duration is computed by `computeAnalyserWindowMs` (`src/route-components/player/audio-visualization/computeAnalyserWindowMs.ts`) and displayed as a `PlaybackMessage` (`"Time window: X ms"`) while either visualization mode is active.

**Render loop:** Both draw functions are called on every `requestAnimationFrame` tick (same loop as video frame rendering) when the corresponding mode is active.

**Auto-selection on file load:** Audio-only files default to `FrequencyRealTime`; files with video tracks default to `Off`.

**Menu:** `PlaybackSettingsAudioVisualizationMenu` (`src/ui-components/base/playback-settings/PlaybackSettingsAudioVisualizationMenu.tsx`) lists the three active modes, then a separator, then `Off` in its own section at the bottom.

##### Waveform overview

Provides a full-file amplitude overview that scrolls beneath a fixed playhead at the horizontal centre of the canvas.

**Data computation (`computeWaveformOverview` in `src/route-components/player/audio-visualization/computeWaveformOverview.ts`):**

- On file load, asynchronously iterates all decoded audio buffers from an `AudioBufferSink`.
- Computes peak absolute amplitude per column across all channels.
- Resolution: `COLUMNS_PER_SECOND` (100) — each column represents a 10 ms time slice.
- Returns a `Float32Array` of normalised amplitude values (0–1), or `undefined` if cancelled.
- Cancellation is checked between buffers via an `isCancelled` callback to support file-switch abort.

**Rendering (`drawWaveformOverview` in `src/route-components/player/audio-visualization/drawWaveformOverview.ts`):**

- Playhead is fixed at the horizontal centre; the waveform scrolls as playback progresses.
- Visible window spans `currentTime ± windowSec / 2`. Out-of-bounds regions are left empty.
- Bar height capped at 80 % of half-canvas height. Fill is a vertical gradient: red at top/bottom edges → white at centre.
- Playhead drawn as a 2 px white vertical line at 10–90 % canvas height.
- While data is computing, draws a thin 2 px semi-transparent horizontal centre line as a loading indicator.

**Zoom:** `+`/`-` keys halve/double the visible window (`waveformOverviewWindowSec`). Range: 1 s – 16 s. Default: `WAVEFORM_OVERVIEW_WINDOW_SEC` (16 s, defined in `Player.types.ts`).

**Playback messages:** Shows `"Computing waveform overview..."` while data is generating, then `"Time window: Xs. Press +/- to zoom in/out."` when ready.

#### Imperative DOM updates

To avoid React re-renders on every frame during playback, certain UI elements are updated imperatively via `document.getElementById`. Element IDs are exported as consts from the component that renders them:

- **Progress bar** (`dom-updates/updateProgressBarDOM.ts`): Updates fill width and thumb position. IDs (`progressBarCurrentId`, `progressBarThumbId`) are exported from `PlayerControlOverlay.types.ts`.
- **Timestamp** (`dom-updates/updateTimestampDOM.ts`): Updates the timestamp text. ID (`timestampTextId`) is exported from `Timestamp.tsx`.
- **Playback message** (`dom-updates/updatePlaybackMessageDOM.ts`): Updates the top-left overlay text (audio-visualization info, or the FPS readout). The element stays mounted and is empty when cleared. ID (`playbackMessageTextId`) is exported from `PlaybackMessage.tsx`. Two writers coordinate via the audio-visualization mode: the message effect owns it while a visualization is active; the render loop owns it (writing the FPS readout) while visualization is `Off`.

These are called from the render loop in `Player.tsx`.

##### FPS readout

A developer overlay for diagnosing playback performance. Gated by the `showFps` atom (`src/shared/atoms/player-controls/showFpsState.ts`, persisted, default on) and shown only while audio visualization is `Off`; the playback message then displays `Render <n> fps · Decoded <n> fps`:

- **Render fps**: the `requestAnimationFrame` render-loop rate, sampled every `FPS_SAMPLE_INTERVAL_MS` (500 ms) on the main thread. This is the upper bound on video FPS (the worker draws at most one frame per tick), so a drop indicates main-thread starvation.
- **Decoded fps**: the actual on-screen frame rate, counted in the worker's `handleTick` (`reportDrawnFrame`) and posted to the main thread via the `DecodedFrameRate` event roughly once per second. `DecodeWorkerManager.decodedFps` caches the latest value; it is reset to 0 on pause and on worker recycle. A decoded rate below the source frame rate means frames are being skipped.

The render loop owns the playback message only while `showFps` is on and visualization is `Off`; toggling `showFps` off clears it (synced via `showFpsRef`). The toggle lives in the Dev Info settings menu (see below).

##### Dev Info menu

`PlaybackSettingsDevInfoMenu` (`src/ui-components/base/playback-settings/PlaybackSettingsDevInfoMenu.tsx`) is a sub-menu of `PlaybackSettings` for developer overlays. Like the Flip menu, its items are independent toggles (chips with `data-toggled-on`) rather than a single-select list. It currently has one item, "Show FPS", bound to the `showFps` atom. Add new dev toggles here. The menu is reached from the "Dev Info" chip on the main settings menu and registered as `PlaybackSettingsMenu.DevInfo`.

#### Player controls (`src/ui-components/level-two/player-control-overlay/PlayerControlOverlay.tsx`)

Shows/hides on hover and auto-hides after 3 seconds of mouse inactivity. Contains: progress bar with preview thumbnail, play/pause button, volume control, timestamp, settings button, and fullscreen button.

##### Idle auto-hide

The overlay auto-hides (along with the mouse cursor) after 3 seconds of no mouse movement (`IDLE_TIMEOUT_MS`). `idleTimerRef` tracks the `setTimeout` handle. `startIdleTimer` clears any existing timer and starts a new one. When the timer fires, it checks `shouldBlockIdleHideRef` — if a menu is open (`isAudioTrackSelectorOpen`, `isSettingsOpen`) or the progress bar is hovered (`isProgressBarHovered`), it restarts the timer instead of hiding. `shouldBlockIdleHideRef` is synced to current state via a `useEffect` to avoid stale closures in the timer callback. The cursor is hidden via CSS: `cursor: none` on the container and all descendants when `data-is-overlay-shown` is not `true`, using higher specificity to override child cursor styles.

##### Interaction tracking

`PlayerControlElement` enum (`PlayerControlOverlay.types.ts`) lists all interactive elements: `AudioTrackButton`, `FullscreenButton`, `Overlay`, `PlayButton`, `ProgressBar`, `SettingsButton`, `Timestamp`, `VolumeControl`.

`handleInteraction(element)` is a centralized handler that every control calls when interacted with. It manages cleanup of states that should reset when a different control is used:

- If the interacted element is not `AudioTrackButton`, close the audio track selector.
- If the interacted element is not `VolumeControl` or `Timestamp`, un-hard-pin volume control.
- If the interacted element is not `SettingsButton`, close the playback settings menu.

`lastInteractedElementRef` tracks the last interacted element. When adding a new player control, add it to the `PlayerControlElement` enum and call `handleInteraction` with it. To add new cross-control cleanup logic, add a condition to `handleInteraction`.

##### Seeking

- **Paused seek**: Calls `seek()` which updates `PlaybackClock`, then tells the decode worker to seek (draws a single frame at the new position without starting playback).
- **Playing seek**: Pauses playback first (stops all queued audio nodes), then resumes at the new position.

##### Volume control (`src/ui-components/level-one/volume-control/VolumeControl.tsx`)

Volume is stored as a 0-1 value in `volumeState` (`src/shared/atoms/volumeState.ts`, persisted via Jotai's `atomWithStorage`). A quadratic curve (`volume * volume`) is applied to the GainNode for more natural perceived loudness control. The `VolumeControl` component expands when pinned, and is pinned when

- the user hovers over it. This is "soft-pinned", and removed when the user moves outside of left container.
- the user clicks on it. This is "hard-pinned", and removed when the user interacts with another player control.

##### Timestamp (`src/ui-components/base/timestamp/Timestamp.tsx`)

Displays current playback time (e.g. "49:24 / 58:27"). Placed to the right of VolumeControl in the left container. Clicking toggles between normal and reversed format (e.g. "-9:03 / 58:27") via a `data-reversed` attribute on the text element. Text content is updated imperatively by `updateTimestampDOM` — the toggle state is read from the DOM attribute. Clicking Timestamp does NOT unpin VolumeControl.

##### Progress bar (`src/ui-components/level-two/player-control-overlay/PlayerControlOverlay.tsx`)

Supports click-to-seek and drag-to-seek:

1. **Hover**: Shows preview thumbnail at hovered position (clamped to stay within bounds).
2. **Mouse down**: Pauses playback if playing, updates progress immediately.
3. **Drag**: Continuously updates progress via document-level `mousemove` listener.
4. **Mouse up**: If was playing, resumes at new position; otherwise calls `seek()` to render frame.

Helper functions: `getProgressPercentageFromEvent` (`src/ui-components/level-two/player-control-overlay/getProgressPercentageFromEvent.ts`, returns 0-1), `getProgressFromEvent` (`src/ui-components/level-two/player-control-overlay/getProgressFromEvent.ts`, converts to seconds).

##### Preview thumbnail

Thumbnail decoding runs in the decode worker via the `GetThumbnail` RPC. The worker uses a dedicated `thumbnailSink` (separate from the playback `videoSink` to avoid iterator pool conflicts), resizes via `OffscreenCanvas`, and encodes to JPEG via `convertToBlob()`. No main-thread `CanvasSink` is used for thumbnails. Preview thumbnails are gated by a decode performance probe — they are only enabled when the file's video can be decoded fast enough for interactive seeking.

**Decode performance probe (`src/route-components/player/utils/getIsPreviewThumbnailEnabled.ts`):**

- On file load, decodes sample frames at 10%, 33%, 66%, and 90% of the video duration using the decode worker's `probe()` RPC.
- Each probe has a 1-second wall-clock timeout (`SINGLE_FRAME_THRESHOLD_MS`). If any single frame exceeds this, the function returns `false` immediately and the manager terminates the hung worker and respawns it.
- Additionally, the average decode time across all samples must be under `AVERAGE_FRAME_THRESHOLD_MS` (250ms).
- Only when all conditions pass does `isPreviewThumbnailEnabled` become `true`, enabling the thumbnail cache and PreviewThumbnail UI.

**PreviewThumbnailCache (`src/route-components/player/preview-thumbnail/PreviewThumbnailCache.ts`)**:

- LRU cache storing `{ timestamp → blob URL }` with a memory limit (default: 100MB).
- Takes a `DecodeWorkerManager` directly and calls `getThumbnail` for decoding.
- Serves as a deduplication cache — prevents re-decoding the same timestamp on repeated seeks.
- `reset()` revokes all blob URLs and clears the cache; the instance remains usable afterwards.

**getThumbnail (`src/route-components/player/preview-thumbnail/getThumbnail.ts`)**:

- Rounds timestamp to nearest second for cache key consistency.

**PreviewThumbnail (`src/ui-components/base/preview-thumbnail/PreviewThumbnail.tsx`)**:

- Uses imperative `img.src` updates via ref instead of React state to keep up with fast mouse movement.
- URL lifecycle managed by `PreviewThumbnailCache`, not this component.

## Critical Configuration

**Do not change without developer consent:**

- `README.md`
- `package.json`
- `tsconfig.json`
- `eslint.config.js`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`

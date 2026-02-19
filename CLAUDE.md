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
pnpm dev           # Frontend only (Vite at localhost:1420)
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
- `level-one/` - Composed components (PlayerControlOverlay)
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
4. Creates `CanvasSink` for video frames (only when video tracks exist) and `AudioBufferSink` for audio buffers.
5. Audio: Schedules `AudioBufferSourceNode` instances via `runAudioIterator`.
6. Video: Renders frames to canvas via `requestAnimationFrame` loop.

A `hasVideo` state tracks whether the current file has video tracks. When `false`: `CanvasSink`, thumbnail cache, and `startVideoIterator` are skipped; `seekImpl` updates only the clock and progress bar; duration is computed from the selected audio track (and recomputed on audio track switch); preview thumbnails and flip/rotate settings are hidden in the UI.

#### PlaybackClock (`src/route-components/player/PlaybackClock.ts`)

Manages playback timing using `AudioContext` as the master clock for A/V sync:

- `timestampAtPlayStart`: The video timestamp we're measuring from (set on play/pause/seek).
- `audioContextTimeAtPlayStart`: The `AudioContext.currentTime` when `play()` was called.
- `currentTime`: Returns `timestampAtPlayStart + (audioContext.currentTime - audioContextTimeAtPlayStart)` when playing, or just `timestampAtPlayStart` when paused.

Both audio and video playback rely on `PlaybackClock.currentTime` to achieve synchronized play, pause, and seek.

#### Video playback

**startVideoIterator (`src/route-components/player/startVideoIterator.ts`)**: Creates a new video frame iterator from `CanvasSink.canvases(time)`, fetches the first two frames, draws the first frame immediately, and stores the second in `nextFrameRef` for the render loop.

**updateNextFrame (`src/route-components/player/updateNextFrame.ts`)**: Called by the render loop when it's time for the next frame. Iterates over the video frame iterator, drawing any frames whose timestamp has passed, and stores the first future frame in `nextFrameRef`. Uses `asyncIdRef` to detect stale async operations from previous seeks.

**Render loop** (in `Player.tsx`): A `requestAnimationFrame` loop that:

1. Gets current playback time from `PlaybackClock.currentTime`.
2. If `nextFrameRef.current.timestamp <= playbackTime`, draws it and calls `updateNextFrame`.
3. Updates the progress bar and timestamp DOM imperatively via `updateProgressBarDOM` and `updateTimestampDOM`.

#### Audio playback (`src/route-components/player/runAudioIterator.ts`)

Schedules audio buffers using Web Audio API:

1. Iterates over `AudioBufferSink.buffers(time)`.
2. For each buffer, creates `AudioBufferSourceNode` and connects to `GainNode`.
3. Schedules playback:
   - Future buffers: `node.start(audioContextTimeAtPlayStart + timestamp - timestampAtPlayStart)`.
   - Past buffers (partially elapsed): `node.start(audioContext.currentTime, offset)`.
4. Throttles when >1 second buffered ahead.
5. Tracks scheduled nodes in `queuedAudioNodes` Set (added after `start()`, removed on `ended`).

**Cleanup (`cleanupPlayback`):** Pauses the clock, clears `nextFrameRef`, stops all nodes in `queuedAudioNodes` via `node.stop()`, releases audio and video iterators via `.return()`, disposes the thumbnail cache, and clears the canvas.

#### Audio visualization

The visualization canvas (`audioVisualizationCanvasRef`) is a separate full-screen `<canvas>` overlaid on top of the video canvas with `pointerEvents: none`. Its visibility is controlled by the `data-visible` attribute, which is set from the `audioVisualization` atom (`src/shared/atoms/player-controls/audioVisualizationState.ts`).

**Modes (`AudioVisualization` enum):**

- `WaveformRealTime` — oscilloscope drawn by `drawAudioWaveform` (`src/route-components/player/drawAudioWaveform.ts`). Uses `getByteTimeDomainData`. Stroke is a vertical gradient: red at the top and bottom edges (peak amplitude) transitioning to blue at the centre line (silence).
- `FrequencyRealTime` — spectrum analyser drawn by `drawAudioFrequencyBars` (`src/route-components/player/drawAudioFrequencyBars.ts`). Uses `getByteFrequencyData`. 80 bars mapped on a logarithmic frequency scale (20 Hz–Nyquist). Bar height is capped at 90% of canvas height. Fill is a vertical gradient: blue at the bottom (quiet) → violet → orange-red at the top (loud).
- `Off` — canvas is hidden.

**AnalyserNode pipeline:**

```
AudioBufferSourceNode → GainNode → AnalyserNode → AudioContext.destination
```

`fftSize` is set to `AUDIO_ANALYSER_FFT_SIZE` (4096), giving `frequencyBinCount` = 2048 and a time window of ~93 ms at 44.1 kHz. The window duration is computed by `computeAnalyserWindowMs` (`src/route-components/player/computeAnalyserWindowMs.ts`) and displayed as a `PlaybackMessage` (`"Time window: X ms"`) while either visualization mode is active.

**Render loop:** Both draw functions are called on every `requestAnimationFrame` tick (same loop as video frame rendering) when the corresponding mode is active.

**Auto-selection on file load:** Audio-only files default to `FrequencyRealTime`; files with video tracks default to `Off`.

**Menu:** `PlaybackSettingsAudioVisualizationMenu` (`src/ui-components/base/playback-settings/PlaybackSettingsAudioVisualizationMenu.tsx`) lists the two active modes, then a separator, then `Off` in its own section at the bottom.

#### Imperative DOM updates

To avoid React re-renders on every frame during playback, certain UI elements are updated imperatively via `document.getElementById`. Element IDs are exported as consts from the component that renders them:

- **Progress bar** (`updateProgressBarDOM.ts`): Updates fill width and thumb position. IDs (`progressBarCurrentId`, `progressBarThumbId`) are exported from `PlayerControlOverlay.types.ts`.
- **Timestamp** (`updateTimestampDOM.ts`): Updates the timestamp text. ID (`timestampTextId`) is exported from `Timestamp.tsx`.

Both are called from the render loop in `Player.tsx`.

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

- **Paused seek**: Calls `seek()` which updates `PlaybackClock`, then calls `startVideoIterator` to draw a single frame at the new position without starting playback.
- **Playing seek**: Pauses playback first (stops all queued audio nodes), then resumes at the new position.

##### Volume control (`src/ui-components/level-one/volume-control/VolumeControl.tsx`)

Volume is stored as a 0-1 value in `volumeState` (`src/shared/atoms/volumeState.ts`, persisted via Jotai's `atomWithStorage`). A quadratic curve (`volume * volume`) is applied to the GainNode for more natural perceived loudness control. The `VolumeControl` component expands when pinned, and is pinned when

- the user hovers over it. This is "soft-pinned", and removed when the user moves outside of left container.
- the user clicks on it. This is "hard-pinned", and removed when the user interacts with another player control.

##### Timestamp (`src/ui-components/base/timestamp/Timestamp.tsx`)

Displays current playback time (e.g. "49:24 / 58:27"). Placed to the right of VolumeControl in the left container. Clicking toggles between normal and reversed format (e.g. "-9:03 / 58:27") via a `data-reversed` attribute on the text element. Text content is updated imperatively by `updateTimestampDOM` — the toggle state is read from the DOM attribute. Clicking Timestamp does NOT unpin VolumeControl.

##### Progress bar (`src/ui-components/level-one/player-control-overlay/PlayerControlOverlay.tsx`)

Supports click-to-seek and drag-to-seek:

1. **Hover**: Shows preview thumbnail at hovered position (clamped to stay within bounds).
2. **Mouse down**: Pauses playback if playing, updates progress immediately.
3. **Drag**: Continuously updates progress via document-level `mousemove` listener.
4. **Mouse up**: If was playing, resumes at new position; otherwise calls `seek()` to render frame.

Helper functions: `getProgressPercentageFromEvent` (`src/ui-components/level-one/player-control-overlay/getProgressPercentageFromEvent.ts`, returns 0-1), `getProgressFromEvent` (`src/ui-components/level-one/player-control-overlay/getProgressFromEvent.ts`, converts to seconds).

##### Preview thumbnail

The PreviewThumbail uses separate `CanvasSink` (`previewThumbnailVideoSink`) dedicated to thumbnail fetching, plus a `PreviewThumbnailCache` for caching.

**PreviewThumbnailCache (`src/route-components/player/PreviewThumbnailCache.ts`)**:

- LRU cache storing `{ timestamp → blob URL }` with a memory limit (default: 100MB).
- Background auto-fill: On file load, fetches thumbnails from timestamp 0.
- On seek, fetch thumbnails on new timestamp.
- Current auto-fill strategy is a bidirectional, linear fetch on rounded timestamps with 1s intervals.
- Auto-fill stops completely when memory limit is reached.
- `dispose()` revokes all blob URLs and clears the cache.

**canvasToThumbnailBlob (`src/route-components/player/canvasToBlob.ts`)**:

- Resizes full-resolution canvas to 160×90 JPEG thumbnails (~28KB each vs ~667KB for full PNG).
- Enables caching ~3500 thumbnails within the 100MB limit.

**getThumbnail (`src/route-components/player/getThumbnail.ts`)**:

- Rounds timestamp to nearest second for cache key consistency with auto-fill.

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

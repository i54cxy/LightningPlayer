/**
 * Manages playback timing using AudioContext as the master clock.
 *
 * Mental model:
 * - `timestampAtPlayStart`: The video timestamp we're measuring from (set on play/pause/seek).
 * - `audioContextTimeAtPlayStart`: The AudioContext.currentTime when play() was called.
 * - Current time = timestampAtPlayStart + (audioContext.currentTime - audioContextTimeAtPlayStart).
 *
 * Both audio and video playback rely on the correctness of currentTime
 * of the PlaybackClock to achieve play, pause, and seek.
 */
export class PlaybackClock {
  public audioContext: AudioContext;
  /** The AudioContext.currentTime when play() was called. */
  public audioContextTimeAtPlayStart: number | undefined;
  /** The playback speed multiplier. 1 means normal speed. */
  public speed: number = 1;
  /** The video timestamp we're measuring from. */
  public timestampAtPlayStart: number = 0;
  private _isPlaying: boolean = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Returns the current playback time in seconds.
   */
  get currentTime(): number {
    if (this._isPlaying) {
      if (this.audioContextTimeAtPlayStart === undefined) {
        console.error(
          "PlaybackClock.currentTime: audioContextTimeAtPlayStart is undefined while playing",
        );
        return -1;
      }
      const elapsed =
        this.audioContext.currentTime - this.audioContextTimeAtPlayStart;
      return this.timestampAtPlayStart + elapsed * this.speed;
    }
    return this.timestampAtPlayStart;
  }

  /**
   * Starts playback from the current timestampAtPlayStart.
   */
  play(): void {
    if (this._isPlaying) return;
    this.audioContextTimeAtPlayStart = this.audioContext.currentTime;
    this._isPlaying = true;
  }

  /**
   * Pauses playback and saves the current time as the new origin.
   */
  pause(): void {
    if (!this._isPlaying) return;
    this.timestampAtPlayStart = this.currentTime;
    // console.log(
    //   `PlaybackClock.pause: timestampAtPlayStart set to ${this.timestampAtPlayStart}`,
    // );
    this._isPlaying = false;
  }

  /**
   * Updates the playback speed. If currently playing, re-anchors the clock
   * so that currentTime remains continuous across the speed change.
   *
   * @param speed - The new playback speed multiplier.
   */
  setSpeed(speed: number): void {
    if (this._isPlaying) {
      // Re-anchor: save current position, then reset the time origin.
      this.timestampAtPlayStart = this.currentTime;
      this.audioContextTimeAtPlayStart = this.audioContext.currentTime;
    }
    this.speed = speed;
  }

  /**
   * Seeks to a specific time. Must be called while paused.
   *
   * @param time - The video timestamp to seek to in seconds.
   */
  seek(time: number): void {
    if (this._isPlaying) {
      console.error("PlaybackClock.seek: cannot seek while playing");
      return;
    }
    this.timestampAtPlayStart = time;
  }
}

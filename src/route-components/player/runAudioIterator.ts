import { WrappedAudioBuffer } from "mediabunny";
import { PlaybackClock } from "./PlaybackClock";
import { timeStretchBuffer } from "./timeStretchBuffer";

/**
 * Schedules audio buffers for playback using Web Audio API.
 *
 * This function iterates over audio buffers from mediabunny and schedules them
 * for playback using AudioBufferSourceNode. It handles:
 * - Time-stretching buffers for pitch-preserved speed change.
 * - Throttling when too far ahead (>1 wall-clock second buffered).
 * - Scheduling future buffers with precise timing.
 * - Playing partially elapsed buffers from the correct offset.
 *
 * @param params.audioBufferIterator - The audio buffer async iterator to read from.
 * @param params.gainNode - GainNode to connect audio sources to.
 * @param params.playbackClock - PlaybackClock instance for timing.
 * @param params.queuedAudioNodes - Set to track scheduled AudioBufferSourceNodes for cleanup.
 * @param params.speed - The playback speed multiplier.
 */
export const runAudioIterator = async ({
  audioBufferIterator,
  gainNode,
  playbackClock,
  queuedAudioNodes,
  speed,
}: {
  audioBufferIterator:
    | AsyncGenerator<WrappedAudioBuffer, void, unknown>
    | undefined;
  gainNode: GainNode;
  playbackClock: PlaybackClock;
  queuedAudioNodes: Set<AudioBufferSourceNode>;
  speed: number;
}): Promise<void> => {
  if (playbackClock.audioContextTimeAtPlayStart === undefined) {
    console.error("runAudioIterator: audioContextTimeAtPlayStart is undefined");
    return;
  }
  if (!audioBufferIterator) {
    console.error("runAudioIterator: audioBufferIterator is undefined");
    return;
  }

  const { audioContext } = playbackClock;

  // To play back audio, we loop over all audio chunks (typically very short)
  // of the file and play them at the correct timestamp.
  // The result is a continuous, uninterrupted audio signal.
  // console.log("runAudioIterator: starting audio loop");
  for await (const { buffer, timestamp } of audioBufferIterator) {
    // Time-stretch the buffer for pitch-preserved speed change.
    const stretchedBuffer = timeStretchBuffer({
      audioContext,
      buffer,
      speed,
    });

    // Schedule audio buffer.
    const node = audioContext.createBufferSource();
    node.buffer = stretchedBuffer;
    node.connect(gainNode);

    const currentTimestamp = playbackClock.currentTime;
    // console.log(`runAudioIterator: ${timestamp}, ${currentTimestamp}`);

    if (timestamp >= currentTimestamp) {
      // If the audio starts in the future, schedule it at the correct time.
      // Wall-clock time for a media timestamp is divided by speed because
      // the clock advances faster at higher speeds.
      // scheduledTime = audioContextTimeAtPlayStart + (timestamp - timestampAtPlayStart) / speed
      node.start(
        playbackClock.audioContextTimeAtPlayStart! +
          (timestamp - playbackClock.timestampAtPlayStart) / speed,
      );
    } else {
      // If it starts in the past, only play the audible section that remains.
      // The offset into the stretched buffer is scaled by 1/speed because
      // the stretched buffer's time axis is scaled by 1/speed.
      node.start(
        audioContext.currentTime,
        (currentTimestamp - timestamp) / speed,
      );
    }

    queuedAudioNodes.add(node);
    node.onended = () => {
      queuedAudioNodes.delete(node);
    };

    // Throttle if too far ahead (>1 wall-clock second buffered).
    // Convert media-time lead to wall-clock lead by dividing by speed.
    if ((timestamp - currentTimestamp) / speed >= 1) {
      await new Promise<void>((resolve) => {
        const id = setInterval(() => {
          // Exit immediately if playback was stopped during throttling.
          if (!playbackClock.isPlaying) {
            clearInterval(id);
            resolve();
            return;
          }
          if ((timestamp - playbackClock.currentTime) / speed < 1) {
            clearInterval(id);
            resolve();
          }
        }, 100);
      });
    }
  }
  // console.log("runAudioIterator: audio loop finished (iterator exhausted)");
};

import { WrappedAudioBuffer } from "mediabunny";
import { PlaybackClock } from "./PlaybackClock";

/**
 * Schedules audio buffers for playback using Web Audio API.
 *
 * This function iterates over audio buffers from mediabunny and schedules them
 * for playback using AudioBufferSourceNode. It handles:
 * - Throttling when too far ahead (>1 second buffered).
 * - Scheduling future buffers with precise timing.
 * - Playing partially elapsed buffers from the correct offset.
 *
 * @param params.audioBufferIterator - The audio buffer async iterator to read from.
 * @param params.gainNode - GainNode to connect audio sources to.
 * @param params.playbackClock - PlaybackClock instance for timing.
 * @param params.queuedAudioNodes - Set to track scheduled AudioBufferSourceNodes for cleanup.
 */
export const runAudioIterator = async ({
  audioBufferIterator,
  gainNode,
  playbackClock,
  queuedAudioNodes,
}: {
  audioBufferIterator:
    | AsyncGenerator<WrappedAudioBuffer, void, unknown>
    | undefined;
  gainNode: GainNode;
  playbackClock: PlaybackClock;
  queuedAudioNodes: Set<AudioBufferSourceNode>;
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
    // Schedule audio buffer.
    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(gainNode);

    const currentTimestamp = playbackClock.currentTime;
    // console.log(`runAudioIterator: ${timestamp}, ${currentTimestamp}`);

    if (timestamp >= currentTimestamp) {
      // If the audio starts in the future, schedule it at the correct time.
      // scheduledTime = audioContextTimeAtPlayStart + (timestamp - timestampAtPlayStart)
      node.start(
        playbackClock.audioContextTimeAtPlayStart! +
          timestamp -
          playbackClock.timestampAtPlayStart,
      );
    } else {
      // If it starts in the past, only play the audible section that remains.
      node.start(audioContext.currentTime, currentTimestamp - timestamp);
    }

    queuedAudioNodes.add(node);
    node.onended = () => {
      queuedAudioNodes.delete(node);
    };

    // Throttle if too far ahead (>1 second buffered).
    if (timestamp - currentTimestamp >= 1) {
      await new Promise<void>((resolve) => {
        const id = setInterval(() => {
          // Exit immediately if playback was stopped during throttling.
          if (!playbackClock.isPlaying) {
            clearInterval(id);
            resolve();
            return;
          }
          if (timestamp - playbackClock.currentTime < 1) {
            clearInterval(id);
            resolve();
          }
        }, 100);
      });
    }
  }
  // console.log("runAudioIterator: audio loop finished (iterator exhausted)");
};

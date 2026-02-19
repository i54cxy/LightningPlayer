import { AudioBufferSink, InputAudioTrack } from "mediabunny";

/**
 * Number of peak columns computed per second of audio.
 * At 100 columns/s each column represents a 10 ms window, giving enough
 * resolution to look sharp when zoomed in to a 10-second viewport.
 * Exported so draw functions can convert between column index and time.
 */
export const COLUMNS_PER_SECOND = 100;

/**
 * Iterates all audio buffers from the given track and computes the peak
 * absolute amplitude in each 10 ms time slice, producing a Float32Array
 * with `Math.ceil(duration * COLUMNS_PER_SECOND)` entries.
 *
 * The computation runs asynchronously and checks `isCancelled` between
 * every decoded buffer so it can be aborted early when a new file is loaded.
 *
 * @param params.audioTrack - The audio track to read from.
 * @param params.duration - Total duration of the track in seconds.
 * @param params.isCancelled - Returns true when the computation should abort.
 * @returns The peak array, or undefined if cancelled or an error occurred.
 */
export const computeWaveformOverview = async ({
  audioTrack,
  duration,
  isCancelled,
}: {
  audioTrack: InputAudioTrack;
  duration: number;
  isCancelled: () => boolean;
}): Promise<Float32Array | undefined> => {
  const columnCount = Math.ceil(duration * COLUMNS_PER_SECOND);
  const peaks = new Float32Array(columnCount);
  const sink = new AudioBufferSink(audioTrack);
  const buffers = sink.buffers(0);

  try {
    for await (const { buffer, timestamp } of buffers) {
      if (isCancelled()) {
        await buffers.return();
        return undefined;
      }

      // Scan all channels and keep the max absolute amplitude per column.
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
          const sampleTime = timestamp + i / buffer.sampleRate;
          const col = Math.floor(sampleTime * COLUMNS_PER_SECOND);
          if (peaks[col] && col >= 0 && col < columnCount) {
            peaks[col] = Math.max(peaks[col], Math.abs(channelData[i]!));
          }
        }
      }
    }
  } catch {
    return undefined;
  }

  return isCancelled() ? undefined : peaks;
};

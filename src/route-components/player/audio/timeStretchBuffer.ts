const GRAIN_SIZE = 2048;
const HOP_SIZE = GRAIN_SIZE / 2;

/**
 * Pre-computed Hann window of GRAIN_SIZE length for smooth crossfading.
 */
const hannWindow = new Float32Array(GRAIN_SIZE);
for (let i = 0; i < GRAIN_SIZE; i++) {
  hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (GRAIN_SIZE - 1)));
}

/**
 * Time-stretches a single channel of audio data using OLA (Overlap-Add).
 * Changes the duration of the audio without changing its pitch.
 *
 * @param params.input - The input audio samples.
 * @param params.outputLength - The desired output length in samples.
 * @param params.speed - The playback speed multiplier.
 * @returns A new Float32Array with the time-stretched audio.
 */
const timeStretchChannel = ({
  input,
  outputLength,
  speed,
}: {
  input: Float32Array;
  outputLength: number;
  speed: number;
}): Float32Array => {
  const output = new Float32Array(outputLength);

  // Synthesis hop size stays constant; analysis hop advances by speed factor.
  const synthesisHop = HOP_SIZE;
  const analysisHop = Math.round(HOP_SIZE * speed);

  let analysisPosition = 0;
  let synthesisPosition = 0;

  while (synthesisPosition < outputLength) {
    const grainLength = Math.min(
      GRAIN_SIZE,
      input.length - analysisPosition,
      outputLength - synthesisPosition,
    );

    if (grainLength <= 0) break;

    for (let i = 0; i < grainLength; i++) {
      // Apply Hann window for smooth overlap-add crossfading.
      output[synthesisPosition + i]! +=
        input[analysisPosition + i]! * hannWindow[i]!;
    }

    analysisPosition += analysisHop;
    synthesisPosition += synthesisHop;
  }

  return output;
};

/**
 * Time-stretches an AudioBuffer using OLA (Overlap-Add) to change playback
 * speed while preserving pitch. Each channel is processed independently.
 *
 * @param params.audioContext - The AudioContext used to create the output buffer.
 * @param params.buffer - The input AudioBuffer to time-stretch.
 * @param params.speed - The playback speed multiplier (e.g. 2.0 = double speed).
 * @returns A new AudioBuffer with time-stretched audio, or the original buffer if speed is 1.
 */
export const timeStretchBuffer = ({
  audioContext,
  buffer,
  speed,
}: {
  audioContext: AudioContext;
  buffer: AudioBuffer;
  speed: number;
}): AudioBuffer => {
  if (speed === 1) return buffer;

  // For very short buffers (shorter than a single grain), return as-is
  // since OLA cannot produce meaningful results.
  if (buffer.length < GRAIN_SIZE) return buffer;

  const outputLength = Math.round(buffer.length / speed);
  const outputBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    outputLength,
    buffer.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const stretchedData = timeStretchChannel({
      input: inputData,
      outputLength,
      speed,
    });
    outputBuffer.getChannelData(channel).set(stretchedData);
  }

  return outputBuffer;
};

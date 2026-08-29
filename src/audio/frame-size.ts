export function chooseFrameSize(minMidi: number, sampleRate: number): number {
  // Roughly 7 periods for stable MPM correlation, rounded to a power of two.
  const minFrequency = 440 * 2 ** ((minMidi - 69) / 12)
  const desired = Math.max(8192, (sampleRate / minFrequency) * 7)
  return Math.min(32768, 2 ** Math.ceil(Math.log2(desired)))
}

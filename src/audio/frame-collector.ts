export class PcmFrameCollector {
  private buffer: Float32Array
  private filled = 0

  constructor(
    private frameSize = 8192,
    private hopSize = 2048
  ) {
    this.assertConfiguration(frameSize, hopSize)
    this.buffer = new Float32Array(frameSize)
  }

  configure(frameSize: number, hopSize: number): void {
    this.assertConfiguration(frameSize, hopSize)
    this.frameSize = frameSize
    this.hopSize = hopSize
    this.buffer = new Float32Array(frameSize)
    this.filled = 0
  }

  push(channel: Float32Array): Float32Array[] {
    const frames: Float32Array[] = []
    for (const sample of channel) {
      this.buffer[this.filled++] = sample
      if (this.filled !== this.frameSize) continue

      frames.push(this.buffer.slice())
      this.buffer.copyWithin(0, this.hopSize)
      this.filled = this.frameSize - this.hopSize
    }
    return frames
  }

  private assertConfiguration(frameSize: number, hopSize: number): void {
    if (
      !Number.isInteger(frameSize) ||
      !Number.isInteger(hopSize) ||
      frameSize <= 0 ||
      hopSize <= 0 ||
      hopSize > frameSize
    ) {
      throw new RangeError('Invalid PCM frame collector configuration')
    }
  }
}

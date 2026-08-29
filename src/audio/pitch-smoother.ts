export class PitchSmoother {
  private history: number[] = []
  private ema: number | null = null

  constructor(
    private readonly medianWindow = 5,
    private readonly alpha = 0.35
  ) {}

  push(value: number): number {
    this.history.push(value)
    if (this.history.length > this.medianWindow) this.history.shift()
    const sorted = [...this.history].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    const median = sorted[middle] ?? value
    this.ema = this.ema === null ? median : this.alpha * median + (1 - this.alpha) * this.ema
    return this.ema
  }

  reset(): void {
    this.history = []
    this.ema = null
  }
}

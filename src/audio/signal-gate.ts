export interface PreparedSignal {
  samples: Float32Array
  rms: number
}

export function dbToAmplitude(db: number): number {
  return 10 ** (db / 20)
}

export function amplitudeToDb(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -120
}

export function prepareSignal(input: Float32Array): PreparedSignal {
  let mean = 0
  for (const value of input) mean += value
  mean /= Math.max(1, input.length)

  const samples = new Float32Array(input.length)
  let sumSquares = 0
  for (let index = 0; index < input.length; index += 1) {
    const value = (input[index] ?? 0) - mean
    samples[index] = value
    sumSquares += value * value
  }
  return { samples, rms: Math.sqrt(sumSquares / Math.max(1, input.length)) }
}

export function passesSignalGate(rms: number, gateDb: number): boolean {
  return rms >= dbToAmplitude(gateDb)
}

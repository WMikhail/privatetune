import { describe, expect, it } from 'vitest'
import { PcmFrameCollector } from '../frame-collector'

describe('PcmFrameCollector', () => {
  it('emits overlapping frames at the configured hop', () => {
    const collector = new PcmFrameCollector(4, 2)
    const frames = collector.push(new Float32Array([0, 1, 2, 3, 4, 5]))

    expect(frames.map((frame) => [...frame])).toEqual([
      [0, 1, 2, 3],
      [2, 3, 4, 5]
    ])
  })

  it('drops a partial old window when reconfigured', () => {
    const collector = new PcmFrameCollector(4, 2)
    expect(collector.push(new Float32Array([1, 2, 3]))).toEqual([])

    collector.configure(3, 1)
    expect(collector.push(new Float32Array([7, 8, 9]))[0]).toEqual(new Float32Array([7, 8, 9]))
  })

  it('rejects configurations that could corrupt the overlap buffer', () => {
    expect(() => new PcmFrameCollector(4, 5)).toThrow(RangeError)
    expect(() => new PcmFrameCollector(0, 0)).toThrow(RangeError)
  })
})

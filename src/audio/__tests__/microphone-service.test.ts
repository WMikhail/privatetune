import { describe, expect, it, vi } from 'vitest'
import { MicrophoneError, MicrophoneService } from '../microphone-service'

describe('MicrophoneService', () => {
  it('requests unprocessed mono audio and releases every track', async () => {
    const stopA = vi.fn()
    const stopB = vi.fn()
    const stream = { getTracks: () => [{ stop: stopA }, { stop: stopB }] } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) }
    })
    const service = new MicrophoneService()
    await service.start('device-1')
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        deviceId: { exact: 'device-1' },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }),
      video: false
    })
    service.stop()
    expect(stopA).toHaveBeenCalledOnce()
    expect(stopB).toHaveBeenCalledOnce()
  })

  it('maps permission denial and a missing API', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')) }
    })
    await expect(new MicrophoneService().start()).rejects.toMatchObject({ status: 'denied' })
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    await expect(new MicrophoneService().start()).rejects.toEqual(
      new MicrophoneError('unsupported')
    )
  })
})

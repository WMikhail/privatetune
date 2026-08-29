import type { MicrophoneStatus } from '@/domain/types'

export class MicrophoneError extends Error {
  constructor(public readonly status: MicrophoneStatus) {
    super(status)
  }
}

export interface AudioInputSource {
  start(deviceId?: string): Promise<MediaStream>
  stop(): void
  listInputs(): Promise<MediaDeviceInfo[]>
}

export class MicrophoneService implements AudioInputSource {
  private stream: MediaStream | null = null

  async start(deviceId = ''): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new MicrophoneError('unsupported')
    this.stop()
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        },
        video: false
      })
      return this.stream
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          throw new MicrophoneError('denied')
        }
        if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
          throw new MicrophoneError('missing')
        }
      }
      throw new MicrophoneError('error')
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }

  async listInputs(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === 'audioinput')
  }
}

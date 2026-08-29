/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type { TunerEngineConfig } from './src/audio/tuner-engine'
import type { MicrophoneStatus, TunerReading } from './src/domain/types'

declare global {
  interface Window {
    /** Test-only dependency seam. Production leaves it undefined. */
    __PRIVATETUNE_TEST_ENGINE_FACTORY__?: (events: {
      onStatus: (status: MicrophoneStatus) => void
      onReading: (reading: TunerReading | null) => void
      onLevel: (level: number) => void
      onDevices: (devices: MediaDeviceInfo[]) => void
    }) => {
      start: () => Promise<void>
      stop: () => Promise<void>
      updateConfig: (config: TunerEngineConfig) => void
    }
  }
}

export {}

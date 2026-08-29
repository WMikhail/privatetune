/// <reference lib="webworker" />
import { MpmPitchDetector } from './pitch-detector'
import { analyzePcmFrame } from './analysis-pipeline'
import type { AnalyzePitchMessage, PitchWorkerMessage } from './audio-protocol'

const detector = new MpmPitchDetector()

self.onmessage = (event: MessageEvent<AnalyzePitchMessage>) => {
  const message = event.data
  if (message.type !== 'analyze') return
  const result = analyzePcmFrame(message.samples, message.sampleRate, message.gateDb, detector)
  postResult({
    ...result,
    timestamp: message.timestamp,
    revision: message.revision
  })
}

function postResult(message: PitchWorkerMessage): void {
  self.postMessage(message)
}

export {}

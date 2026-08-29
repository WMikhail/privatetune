import type { TunerReading } from './types'

export const GUIDED_STABLE_MS = 750
export const GUIDED_MAX_READING_GAP_MS = 260
export const GUIDED_MIN_CLARITY = 0.82

export type GuidedSessionPhase = 'idle' | 'tuning' | 'verification' | 'complete'
export type GuidedSessionEvent =
  'string-complete' | 'verification-started' | 'string-verified' | 'session-complete'

export interface GuidedSessionState {
  phase: GuidedSessionPhase
  stringCount: number
  currentIndex: number
  tuned: boolean[]
  verified: boolean[]
  stableSince: number | null
  lastReadingAt: number | null
  stableProgress: number
}

export interface GuidedSessionUpdate {
  state: GuidedSessionState
  event: GuidedSessionEvent | null
}

type GuidedReading = Pick<TunerReading, 'clarity' | 'state' | 'stringIndex' | 'timestamp'>

export function idleGuidedSession(): GuidedSessionState {
  return {
    phase: 'idle',
    stringCount: 0,
    currentIndex: 0,
    tuned: [],
    verified: [],
    stableSince: null,
    lastReadingAt: null,
    stableProgress: 0
  }
}

export function startGuidedSession(stringCount: number): GuidedSessionState {
  if (!Number.isInteger(stringCount) || stringCount <= 0) return idleGuidedSession()
  return {
    phase: 'tuning',
    stringCount,
    currentIndex: 0,
    tuned: Array.from({ length: stringCount }, () => false),
    verified: Array.from({ length: stringCount }, () => false),
    stableSince: null,
    lastReadingAt: null,
    stableProgress: 0
  }
}

export function isGuidedSessionActive(state: GuidedSessionState): boolean {
  return state.phase === 'tuning' || state.phase === 'verification'
}

function resetStability(state: GuidedSessionState): GuidedSessionState {
  if (state.stableSince === null && state.lastReadingAt === null && state.stableProgress === 0) {
    return state
  }
  return { ...state, stableSince: null, lastReadingAt: null, stableProgress: 0 }
}

export function updateGuidedSession(
  state: GuidedSessionState,
  reading: GuidedReading | null
): GuidedSessionUpdate {
  if (!isGuidedSessionActive(state)) return { state, event: null }

  const valid =
    reading !== null &&
    Number.isFinite(reading.timestamp) &&
    reading.stringIndex === state.currentIndex &&
    reading.state === 'in-tune' &&
    reading.clarity >= GUIDED_MIN_CLARITY

  if (!valid || !reading) return { state: resetStability(state), event: null }

  const readingGap =
    state.lastReadingAt === null ? 0 : Math.max(0, reading.timestamp - state.lastReadingAt)
  const stableSince =
    state.stableSince === null || readingGap > GUIDED_MAX_READING_GAP_MS
      ? reading.timestamp
      : state.stableSince
  const stableProgress = Math.min(
    1,
    Math.max(0, (reading.timestamp - stableSince) / GUIDED_STABLE_MS)
  )
  const measuring = {
    ...state,
    stableSince,
    lastReadingAt: reading.timestamp,
    stableProgress
  }

  if (stableProgress < 1) return { state: measuring, event: null }

  const completed = state.phase === 'tuning' ? [...state.tuned] : [...state.verified]
  completed[state.currentIndex] = true
  const nextIndex = state.currentIndex + 1

  if (nextIndex < state.stringCount) {
    return {
      state: {
        ...measuring,
        currentIndex: nextIndex,
        tuned: state.phase === 'tuning' ? completed : state.tuned,
        verified: state.phase === 'verification' ? completed : state.verified,
        stableSince: null,
        lastReadingAt: null,
        stableProgress: 0
      },
      event: state.phase === 'tuning' ? 'string-complete' : 'string-verified'
    }
  }

  if (state.phase === 'tuning') {
    return {
      state: {
        ...measuring,
        phase: 'verification',
        currentIndex: 0,
        tuned: completed,
        stableSince: null,
        lastReadingAt: null,
        stableProgress: 0
      },
      event: 'verification-started'
    }
  }

  return {
    state: {
      ...measuring,
      phase: 'complete',
      verified: completed,
      stableSince: null,
      lastReadingAt: null,
      stableProgress: 1
    },
    event: 'session-complete'
  }
}

import { describe, expect, it } from 'vitest'
import { GUIDED_STABLE_MS, startGuidedSession, updateGuidedSession } from '../guided-session'
import type { GuidedSessionUpdate } from '../guided-session'

function reading(index: number, timestamp: number, centsState: 'in-tune' | 'close' = 'in-tune') {
  return { clarity: 0.96, state: centsState, stringIndex: index, timestamp }
}

function completeCurrent(state: ReturnType<typeof startGuidedSession>, timestamp: number) {
  let update: GuidedSessionUpdate = { state, event: null }
  for (let elapsed = 0; elapsed <= GUIDED_STABLE_MS; elapsed += 150) {
    update = updateGuidedSession(update.state, reading(state.currentIndex, timestamp + elapsed))
  }
  return update
}

describe('guided tuning session', () => {
  it('requires a continuous stable reading before advancing', () => {
    let state = startGuidedSession(4)
    state = updateGuidedSession(state, reading(0, 100)).state
    expect(state.stableProgress).toBe(0)

    state = updateGuidedSession(state, reading(0, 300)).state
    expect(state.stableProgress).toBeGreaterThan(0)
    state = updateGuidedSession(state, reading(0, 350, 'close')).state
    expect(state.stableProgress).toBe(0)

    const completed = completeCurrent(state, 1000)
    expect(completed.event).toBe('string-complete')
    expect(completed.state.currentIndex).toBe(1)
    expect(completed.state.tuned).toEqual([true, false, false, false])
  })

  it('runs a tuning pass, a verification pass and completes', () => {
    let state = startGuidedSession(2)
    let update = completeCurrent(state, 0)
    state = update.state
    expect(update.event).toBe('string-complete')

    update = completeCurrent(state, 1000)
    state = update.state
    expect(update.event).toBe('verification-started')
    expect(state.phase).toBe('verification')
    expect(state.currentIndex).toBe(0)
    expect(state.tuned).toEqual([true, true])

    state = completeCurrent(state, 2000).state
    update = completeCurrent(state, 3000)
    expect(update.event).toBe('session-complete')
    expect(update.state.phase).toBe('complete')
    expect(update.state.verified).toEqual([true, true])
  })
})

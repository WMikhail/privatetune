import { afterEach, vi } from 'vitest'

afterEach(() => {
  localStorage.clear()
  delete window.__PRIVATETUNE_TEST_ENGINE_FACTORY__
  vi.restoreAllMocks()
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(performance.now()), 0)
globalThis.cancelAnimationFrame = (id: number) => window.clearTimeout(id)

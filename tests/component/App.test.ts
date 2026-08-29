import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '@/App.vue'
import { GUIDED_STABLE_MS } from '@/domain/guided-session'
import type { TunerReading } from '@/domain/types'
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '@/stores/persistence'
import { useTunerStore } from '@/stores/tuner'

function mountApp(): VueWrapper {
  return mount(App, { global: { plugins: [createPinia()] }, attachTo: document.body })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('App flows', () => {
  it('starts, publishes a deterministic reading and stops', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => ({
      updateConfig: vi.fn(),
      start: async () => {
        events.onStatus('running')
        events.onLevel(0.15)
        events.onReading({
          frequency: 82.41,
          rawFrequency: 82.41,
          clarity: 0.97,
          rms: 0.15,
          timestamp: 1,
          midi: 40,
          noteMidi: 40,
          cents: 0.1,
          targetFrequency: 82.407,
          stringIndex: 0,
          state: 'in-tune'
        })
      },
      stop: async () => {
        stop()
        events.onStatus('idle')
        events.onReading(null)
      }
    })
    const wrapper = mountApp()
    await wrapper.get('button.mic-button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('E2')
    expect(wrapper.text()).toContain('Настроено')
    expect(wrapper.text()).toContain('СТРУНА 6 · ОТКРЫТАЯ')
    expect(wrapper.get('.control-panel').classes()).toContain('control-panel--collapsed')
    expect(wrapper.get('.mobile-selection__change').text()).toBe('Изменить')
    expect(wrapper.get('.gauge').attributes('aria-live')).toBeUndefined()
    expect(wrapper.get('.gauge .sr-only').text()).toBe('E2, Настроено')
    expect(wrapper.get<HTMLElement>('.meter__needle').element.style.left).toBe('50%')
    await wrapper.get('button.stop-button').trigger('click')
    await flushPromises()
    expect(stop).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Настройте инструмент')
  })

  it('shows denied and unsupported microphone states', async () => {
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => ({
      updateConfig: vi.fn(),
      start: async () => events.onStatus('denied'),
      stop: vi.fn().mockResolvedValue(undefined)
    })
    let wrapper = mountApp()
    await wrapper.get('button.mic-button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Доступ отклонён')
    wrapper.unmount()
    document.body.innerHTML = ''

    delete window.__PRIVATETUNE_TEST_ENGINE_FACTORY__
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    wrapper = mountApp()
    await wrapper.get('button.mic-button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('API не поддерживается')
    expect(wrapper.get('button.mic-button').attributes('disabled')).toBeDefined()
  })

  it('offers direct recovery actions for signal problems', async () => {
    let setStatus: (status: 'weak-signal' | 'noisy-signal' | 'no-signal') => void = () => undefined
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => {
      setStatus = events.onStatus
      return {
        updateConfig: vi.fn(),
        start: async () => events.onStatus('weak-signal'),
        stop: vi.fn().mockResolvedValue(undefined)
      }
    }
    const wrapper = mountApp()
    const store = useTunerStore()

    await wrapper.get('button.mic-button').trigger('click')
    await flushPromises()
    await wrapper.get('.status-callout__action').trigger('click')
    expect(store.settings.noiseGateDb).toBe(-60)

    setStatus('noisy-signal')
    await nextTick()
    await wrapper.get('.status-callout__action').trigger('click')
    expect(store.settings.noiseGateDb).toBe(-55)

    setStatus('no-signal')
    await nextTick()
    await wrapper.get('.status-callout__action').trigger('click')
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('selects an instrument, tuning, mode and guided string', async () => {
    const wrapper = mountApp()
    const store = useTunerStore()
    store.setInterfaceMode('professional')
    store.settings.showStrings = true
    await nextTick()
    const selects = wrapper.findAll('.control-panel select')
    await selects[0]!.setValue('bass-5')
    expect(wrapper.text()).toContain('B Standard')
    await selects[1]!.setValue('b5-drop-a')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('b5-drop-a')
    const stringButtons = wrapper.findAll('.string-button')
    await stringButtons[2]!.trigger('click')
    expect(wrapper.find('input[value="guided"]').element).toHaveProperty('checked', true)
    expect(stringButtons[2]!.attributes('aria-pressed')).toBe('true')
  })

  it('guides every string through tuning and verification before completing', async () => {
    let publish: (reading: TunerReading | null) => void = () => undefined
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => {
      publish = events.onReading
      return {
        updateConfig: vi.fn(),
        start: async () => events.onStatus('running'),
        stop: vi.fn().mockResolvedValue(undefined)
      }
    }
    const wrapper = mountApp()
    await wrapper.get('button.guided-session-launch').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ПРОХОД 1 ИЗ 2')
    expect(wrapper.text()).toContain('Настройте струну 6')
    expect(useTunerStore().settings.mode).toBe('guided')

    async function publishStable(index: number, timestamp: number): Promise<void> {
      const base: TunerReading = {
        frequency: 65.406,
        rawFrequency: 65.406,
        clarity: 0.96,
        rms: 0.14,
        timestamp,
        midi: 36,
        noteMidi: 36,
        cents: 0.1,
        targetFrequency: 65.406,
        stringIndex: index,
        state: 'in-tune'
      }
      for (let elapsed = 0; elapsed <= GUIDED_STABLE_MS; elapsed += 150) {
        publish({ ...base, timestamp: timestamp + elapsed })
        await nextTick()
      }
    }

    for (let index = 0; index < 6; index += 1) await publishStable(index, index * 1000)
    expect(wrapper.text()).toContain('КОНТРОЛЬ 2 ИЗ 2')
    expect(wrapper.text()).toContain('Проверьте струну 6')

    for (let index = 0; index < 6; index += 1) await publishStable(index, 10_000 + index * 1000)
    expect(wrapper.text()).toContain('Все струны настроены')
    expect(useTunerStore().settings.mode).toBe('automatic')

    await wrapper.findAll('.control-panel select')[1]!.setValue('g6-drop-d')
    expect(wrapper.text()).not.toContain('Все струны настроены')
  })

  it('releases the wake lock when the engine becomes inactive after an error', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, data: { ...DEFAULT_SETTINGS, wakeLock: true } })
    )
    let setStatus: (status: 'running' | 'error') => void = () => undefined
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => {
      setStatus = events.onStatus
      return {
        updateConfig: vi.fn(),
        start: async () => events.onStatus('running'),
        stop: vi.fn().mockResolvedValue(undefined)
      }
    }
    const wrapper = mountApp()

    await wrapper.get('button.mic-button').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('screen')

    setStatus('error')
    await flushPromises()
    expect(release).toHaveBeenCalledOnce()
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('releases a wake lock granted after the tuner became inactive', async () => {
    let grant!: (lock: WakeLockSentinel) => void
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn(
      () =>
        new Promise<WakeLockSentinel>((resolve) => {
          grant = resolve
        })
    )
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, data: { ...DEFAULT_SETTINGS, wakeLock: true } })
    )
    let setStatus: (status: 'running' | 'error') => void = () => undefined
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => {
      setStatus = events.onStatus
      return {
        updateConfig: vi.fn(),
        start: async () => events.onStatus('running'),
        stop: vi.fn().mockResolvedValue(undefined)
      }
    }
    const wrapper = mountApp()

    await wrapper.get('button.mic-button').trigger('click')
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    setStatus('error')
    await nextTick()
    grant({ release } as unknown as WakeLockSentinel)
    await flushPromises()

    expect(release).toHaveBeenCalledOnce()
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('cancels an active session when its custom tuning targets change', async () => {
    mountApp()
    const store = useTunerStore()
    const tuning = store.addCustomTuning({
      name: 'Mutable Drop',
      family: 'custom',
      stringCount: 4,
      strings: [28, 33, 38, 43]
    })
    store.setInstrument('custom')
    expect(store.beginGuidedSession()).toBe(true)

    store.updateCustomTuning({ ...tuning, strings: [26, 33, 38, 43] })
    await nextTick()

    expect(store.guidedSession.phase).toBe('idle')
  })

  it('keeps an active guided target when switching to the standard interface', () => {
    mountApp()
    const store = useTunerStore()
    store.setInterfaceMode('professional')
    store.settings.mode = 'chromatic'
    store.beginGuidedSession()

    store.setInterfaceMode('standard')
    expect(store.settings.mode).toBe('guided')
    store.cancelGuidedSession()
    expect(store.settings.mode).toBe('automatic')
  })

  it('switches to the professional interface and enables optional panels from settings', async () => {
    const wrapper = mountApp()
    await wrapper.get('button[aria-label="Открыть настройки"]').trigger('click')
    await nextTick()

    document.querySelector<HTMLInputElement>('input[value="professional"]')!.click()
    await nextTick()
    expect(wrapper.find('.target-summary').exists()).toBe(true)
    expect(wrapper.find('.right-panel').exists()).toBe(false)
    const toggles = document.querySelectorAll<HTMLInputElement>('.preference-list input')
    toggles[1]!.click()
    toggles[2]!.click()
    await nextTick()

    expect(wrapper.find('.mode-switch').exists()).toBe(true)
    expect(wrapper.find('.string-strip').exists()).toBe(true)
    expect(wrapper.find('.signal-panel').exists()).toBe(true)
    expect(wrapper.find('.gauge__frequency').exists()).toBe(false)
    useTunerStore().status = 'running'
    await nextTick()
    expect(wrapper.find('.gauge__frequency').exists()).toBe(true)
  })

  it('creates and persists a custom tuning through the accessible settings dialog', async () => {
    const wrapper = mountApp()
    await wrapper.get('button[aria-label="Открыть настройки"]').trigger('click')
    await nextTick()
    document.querySelector<HTMLInputElement>('input[value="professional"]')!.click()
    await nextTick()
    const add = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Добавить')
    )
    expect(add).toBeDefined()
    add!.click()
    await nextTick()
    const name = document.querySelector<HTMLInputElement>(
      'input[placeholder="Например, My Drop F"]'
    )
    expect(name).not.toBeNull()
    name!.value = 'Studio Drop'
    name!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const save = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Добавить строй')
    )
    save!.click()
    await nextTick()
    expect(wrapper.text()).toContain('Studio Drop')
    expect(localStorage.getItem('privatetune:custom-tunings')).toContain('Studio Drop')
  })

  it('restores settings from localStorage', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        version: 1,
        data: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'professional',
          instrumentKey: 'guitar-8',
          tuningId: 'g8-drop-e',
          a4: 432
        }
      })
    )
    const wrapper = mountApp()
    expect((wrapper.findAll('.control-panel select')[0]!.element as HTMLSelectElement).value).toBe(
      'guitar-8'
    )
    expect(wrapper.text()).toContain('A4 = 432 Hz')
  })

  it('starts in a calm standard interface with optional details hidden', () => {
    const wrapper = mountApp()
    const store = useTunerStore()

    expect(store.settings).toMatchObject({
      interfaceMode: 'standard',
      tuningId: 'g6-e-standard',
      showGuidedSession: true,
      showStrings: false,
      showSignalPanel: false
    })
    expect(wrapper.text()).toContain('E Standard')
    expect(wrapper.text()).toContain('Тюнер сам определит нужную струну')
    expect(wrapper.find('.mode-switch').exists()).toBe(false)
    expect(wrapper.find('.right-panel').exists()).toBe(false)
    expect(wrapper.find('.gauge__frequency').exists()).toBe(false)
    expect(wrapper.find('.gauge__idle').exists()).toBe(true)
    expect(wrapper.find('.status-callout').exists()).toBe(false)
  })
})

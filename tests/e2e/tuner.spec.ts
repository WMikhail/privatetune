import { expect, test, type Page } from '@playwright/test'

async function installTestEngine(page: Page, startStatus = 'running') {
  await page.addInitScript((status) => {
    window.__PRIVATETUNE_TEST_ENGINE_FACTORY__ = (events) => ({
      updateConfig: () => undefined,
      start: async () => {
        events.onStatus(status as 'running' | 'denied')
        if (status === 'running') {
          events.onDevices([])
          events.onLevel(0.14)
          const publish = (stringIndex: number, timestamp = performance.now()) =>
            events.onReading({
              frequency: 82.41,
              rawFrequency: 82.41,
              clarity: 0.96,
              rms: 0.14,
              timestamp,
              midi: 40,
              noteMidi: 40,
              cents: 0.1,
              targetFrequency: 82.407,
              stringIndex,
              state: 'in-tune'
            })
          ;(
            window as Window & { __PRIVATETUNE_TEST_PUBLISH__?: typeof publish }
          ).__PRIVATETUNE_TEST_PUBLISH__ = publish
          publish(0)
        }
      },
      stop: async () => {
        events.onStatus('idle')
        events.onReading(null)
        events.onLevel(0)
      }
    })
  }, startStatus)
}

test('responsive main screen has no critical console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByText('PrivateTune', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать настройку' })).toBeVisible()
  await expect(page.getByText('Звук остаётся на устройстве')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})

test('standard and professional interfaces expose the right amount of control', async ({
  page
}) => {
  await installTestEngine(page)
  await page.goto('/')

  await expect(page.locator('.control-panel select').nth(1)).toHaveValue('g6-e-standard')
  await expect(page.locator('.right-panel')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Хроматика' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Открыть настройки' }).click()
  await page.getByRole('radio', { name: /Профессиональный/ }).check()
  await expect(page.locator('.right-panel')).toHaveCount(0)
  await page.getByRole('checkbox', { name: /Показывать струны/ }).check()
  await page.getByRole('checkbox', { name: /Показывать качество сигнала/ }).check()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('radio', { name: 'Хроматика' })).toBeVisible()
  await expect(page.locator('.string-strip')).toBeVisible()
  await expect(page.locator('.signal-panel')).toBeVisible()
  await page.getByRole('button', { name: 'Начать настройку' }).click()
  await expect(page.getByText('82.41')).toBeVisible()
  await expect(page.getByText('Настроено', { exact: true })).toBeVisible()
  const changeControls = page.getByRole('button', { name: 'Изменить' })
  if (await changeControls.isVisible()) await changeControls.click()
  await page.getByLabel('Инструмент').selectOption('bass-5')
  await page.locator('.control-panel select').nth(1).selectOption('b5-drop-a')
  await page.getByRole('button', { name: /Струна 3, A1/ }).click()
  await expect(page.getByRole('radio', { name: 'Струна' })).toBeChecked()
  await page.getByRole('button', { name: 'Завершить настройку и выключить микрофон' }).click()
  await expect(page.getByRole('button', { name: 'Начать настройку' })).toBeVisible()
})

test('full guided session advances through tuning and verification', async ({ page }) => {
  await installTestEngine(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Настроить все струны' }).click()
  await expect(page.getByText('ПРОХОД 1 ИЗ 2')).toBeVisible()
  await expect(page.getByText('Настройте струну 6')).toBeVisible()

  async function publishStable(index: number): Promise<void> {
    await page.evaluate(async (stringIndex) => {
      const publish = (
        window as Window & {
          __PRIVATETUNE_TEST_PUBLISH__?: (index: number, timestamp?: number) => void
        }
      ).__PRIVATETUNE_TEST_PUBLISH__
      if (!publish) throw new Error('Test pitch publisher is unavailable')
      const timestamp = performance.now()
      for (let elapsed = 0; elapsed <= 750; elapsed += 150) {
        publish(stringIndex, timestamp + elapsed)
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      }
    }, index)
  }

  for (let index = 0; index < 6; index += 1) await publishStable(index)
  await expect(page.getByText('КОНТРОЛЬ 2 ИЗ 2')).toBeVisible()
  for (let index = 0; index < 6; index += 1) await publishStable(index)

  await expect(page.getByText('Все струны настроены')).toBeVisible()
})

test('denied permission is explained without losing retry action', async ({ page }) => {
  await installTestEngine(page, 'denied')
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать настройку' }).click()
  await expect(page.getByText('Доступ отклонён')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Повторить запрос' })).toBeEnabled()
})

test('custom tuning persists after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Открыть настройки' }).click()
  await page.getByRole('radio', { name: /Профессиональный/ }).check()
  await page.locator('summary').filter({ hasText: 'Мои строи' }).click()
  await page.getByRole('button', { name: /Добавить/ }).click()
  await page.getByPlaceholder('Например, My Drop F').fill('E2E Drop')
  await page.getByRole('button', { name: 'Добавить строй' }).click()
  await expect(page.getByRole('dialog').getByText('E2E Drop', { exact: true })).toBeVisible()
  await page.reload()
  const tuningSelect = page.locator('.control-panel select').nth(1)
  await expect(tuningSelect).toHaveValue(/custom-/)
  await expect(tuningSelect.locator('option:checked')).toHaveText('E2E Drop')
})

test('settings dialog supports keyboard and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const settings = page.getByRole('button', { name: 'Открыть настройки' })
  await settings.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  const duration = await page
    .locator('.dialog-content')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration) || 0)
  expect(duration).toBeLessThanOrEqual(0.001)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(settings).toBeFocused()
})

test('mobile touch controls meet the 44px target', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only assertion')
  await page.goto('/')
  const primaryBox = await page.getByRole('button', { name: 'Начать настройку' }).boundingBox()
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  expect((primaryBox?.y ?? 0) + (primaryBox?.height ?? 0)).toBeLessThan(viewportHeight)
  const controls = page.locator('button:visible, select:visible')
  const count = await controls.count()
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5)
  }
})

test('production PWA reloads offline after precache', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-desktop'), 'single Chromium PWA check')
  await page.goto('/')
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker unavailable')
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('PrivateTune', { exact: true })).toBeVisible()
  await context.setOffline(false)
})

test('Chromium obtains a real fake MediaStream and stops its track', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-desktop'), 'Chromium fake-device check')
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices) return
    const original = mediaDevices.getUserMedia.bind(mediaDevices)
    mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints)
      for (const track of stream.getTracks()) {
        const originalStop = track.stop.bind(track)
        track.stop = () => {
          ;(window as Window & { __trackStopped?: boolean }).__trackStopped = true
          originalStop()
        }
      }
      return stream
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать настройку' }).click()
  const finish = page.getByRole('button', {
    name: 'Завершить настройку и выключить микрофон'
  })
  await expect(finish).toBeVisible({ timeout: 15_000 })
  await finish.click()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean((window as Window & { __trackStopped?: boolean }).__trackStopped))
    )
    .toBe(true)
})

test('captures the active production layout for visual review', async ({ page }, testInfo) => {
  await installTestEngine(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать настройку' }).click()
  await expect(page.getByText('Настроено', { exact: true })).toBeVisible()
  await page.screenshot({
    path: `/private/tmp/privatetune-${testInfo.project.name}.png`,
    fullPage: true
  })
  await page.getByRole('button', { name: 'Открыть настройки' }).click()
  await page.getByRole('radio', { name: /Профессиональный/ }).check()
  await page.getByRole('checkbox', { name: /Показывать струны/ }).check()
  await page.getByRole('checkbox', { name: /Показывать качество сигнала/ }).check()
  await page.screenshot({ path: `/private/tmp/privatetune-settings-${testInfo.project.name}.png` })
  await page.keyboard.press('Escape')
  await page.screenshot({
    path: `/private/tmp/privatetune-pro-${testInfo.project.name}.png`,
    fullPage: true
  })
})

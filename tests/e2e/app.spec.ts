import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

const fixtureDirectory = join(process.cwd(), 'test-results', 'fixtures')
const audioFixture = join(fixtureDirectory, 'synthetic-speech.wav')

test.beforeAll(async () => {
  await mkdir(fixtureDirectory, { recursive: true })
  await writeFile(audioFixture, createWaveFixture(6))
})

test.afterAll(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true })
})

test('captures injected PCM and shows fixed English/Vietnamese captions', async () => {
  const application = await electron.launch({
    args: [
      '.',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${audioFixture}`
    ],
    env: { ...process.env, WLC_E2E: '1' }
  })
  try {
    const page = await application.firstWindow()
    const diagnostics: string[] = []
    page.on('console', (message) => diagnostics.push(`console:${message.type()}:${message.text()}`))
    page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`))
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    if ((await page.getByRole('heading', { name: 'Wedding Live Captions' }).count()) === 0) {
      throw new Error(
        `Operator renderer did not mount. URL=${page.url()} diagnostics=${diagnostics.join(' | ')} HTML=${(await page.content()).slice(0, 1_000)}`
      )
    }
    await expect(page.getByRole('heading', { name: 'Wedding Live Captions' })).toBeVisible()
    await page.getByLabel('Azure region').fill('fixture')
    await page.getByLabel('Azure Speech key').fill('fixture-credential')
    await page.getByRole('button', { name: 'Authorize & refresh' }).click()
    await expect(page.getByLabel('Soundboard audio input')).not.toHaveValue('')
    await page.getByRole('button', { name: 'Start captions' }).click()
    await expect(page.getByText('Welcome, family and friends.')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Chào mừng gia đình và bạn bè.')).toBeVisible()

    const viewports = [
      { width: 1_280, height: 720 },
      { width: 1_920, height: 1_080 },
      { width: 3_840, height: 2_160 }
    ]
    for (const viewport of viewports) {
      await application.evaluate(({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height)
      }, viewport)
      await page.goto('http://127.0.0.1:43117/overlay?mode=screen')
      await expect(page.locator('#english-lane')).toBeVisible()
      await expect(page.locator('#vietnamese-lane')).toBeVisible()
    }
    await page.goto('http://127.0.0.1:43117/overlay?mode=obs')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  } finally {
    await application.close()
  }
})

function createWaveFixture(seconds: number): Buffer {
  const sampleRate = 48_000
  const samples = sampleRate * seconds
  const bytesPerSample = 2
  const dataSize = samples * bytesPerSample
  const output = Buffer.alloc(44 + dataSize)
  output.write('RIFF', 0)
  output.writeUInt32LE(36 + dataSize, 4)
  output.write('WAVEfmt ', 8)
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(1, 22)
  output.writeUInt32LE(sampleRate, 24)
  output.writeUInt32LE(sampleRate * bytesPerSample, 28)
  output.writeUInt16LE(bytesPerSample, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36)
  output.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < samples; index += 1) {
    const amplitude = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 3_000)
    output.writeInt16LE(amplitude, 44 + index * bytesPerSample)
  }
  return output
}

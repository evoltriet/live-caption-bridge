import { describe, expect, it } from 'vitest'
import {
  assertNativeOverlayOptions,
  assertSessionConfig,
  isLanguageMode
} from '@live-caption-bridge/caption-protocol'

describe('IPC contract validation', () => {
  it('accepts only the supported language modes', () => {
    expect(isLanguageMode('auto')).toBe(true)
    expect(isLanguageMode('vi-VN')).toBe(true)
    expect(isLanguageMode('fr-FR')).toBe(false)
  })

  it('rejects malformed provider payloads before they reach the provider', () => {
    expect(() => assertSessionConfig({ provider: 'shell', languageMode: 'auto' })).toThrow()
    expect(() =>
      assertSessionConfig({ provider: 'azure', languageMode: 'auto', azureKey: 42 })
    ).toThrow('Azure key must be text')
  })

  it('bounds native overlay settings before creating a window', () => {
    expect(() =>
      assertNativeOverlayOptions({
        displayId: 1,
        placement: 'bottom',
        widthPercent: 101,
        scale: 1,
        opacity: 0.9,
        background: 'gradient',
        profile: 'bilingual'
      })
    ).toThrow('Invalid native overlay options')
  })
})

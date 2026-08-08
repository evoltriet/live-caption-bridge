import { describe, expect, it } from 'vitest'
import { assertSessionConfig, isLanguageMode } from '../src/shared/contracts'

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
})

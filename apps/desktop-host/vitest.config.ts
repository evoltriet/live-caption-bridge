import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@live-caption-bridge/caption-client': resolve('../../packages/caption-client/src'),
      '@live-caption-bridge/caption-protocol': resolve('../../packages/caption-protocol/src'),
      '@live-caption-bridge/web-receiver': resolve('../web-receiver/src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
})

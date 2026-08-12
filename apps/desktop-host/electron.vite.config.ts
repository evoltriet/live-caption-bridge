import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@live-caption-bridge/caption-client',
          '@live-caption-bridge/caption-protocol',
          '@live-caption-bridge/web-receiver'
        ]
      })
    ],
    resolve: {
      alias: {
        '@live-caption-bridge/caption-client': resolve('../../packages/caption-client/src'),
        '@live-caption-bridge/caption-protocol': resolve('../../packages/caption-protocol/src'),
        '@live-caption-bridge/web-receiver': resolve('../web-receiver/src')
      }
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@live-caption-bridge/caption-protocol']
      })
    ],
    resolve: {
      alias: {
        '@live-caption-bridge/caption-protocol': resolve('../../packages/caption-protocol/src')
      }
    },
    build: {
      rollupOptions: {
        output: { format: 'cjs' }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@live-caption-bridge/caption-protocol': resolve('../../packages/caption-protocol/src')
      }
    },
    plugins: [react()]
  }
})

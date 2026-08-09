import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/out',
      '**/release',
      '**/coverage',
      '**/node_modules',
      '**/*.tsbuildinfo',
      'offline/results'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/desktop-host/src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    files: [
      'apps/desktop-host/src/main/**/*.ts',
      'apps/desktop-host/src/preload/**/*.ts',
      'apps/desktop-host/tests/**/*.ts',
      'apps/web-receiver/**/*.ts',
      'packages/**/*.ts'
    ],
    languageOptions: {
      globals: globals.node
    }
  }
)

import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'eslint.config.js'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off'
    }
  },
  {
    files: ['**/*.js'],
    languageOptions: { globals: { process: 'readonly' } }
  }
)

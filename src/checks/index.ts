import type { Check } from '../core/types';
import { helloCheck } from './hello';
import { scriptCheck } from './script';

const PLAYWRIGHT_CONFIG = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'e2e', testIgnore: ['**/a11y/**', '**/visual/**'] },
    { name: 'a11y', testMatch: ['**/a11y/**/*.spec.ts'] },
    { name: 'visual', testMatch: ['**/visual/**/*.spec.ts'] },
  ],
});
`;

const SECRETLINT_CONFIG = `{
  "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }]
}
`;

const SECRETLINT_IGNORE = `node_modules/**
dist/**
coverage/**
.qa/**
playwright-report/**
test-results/**
package-lock.json
**/*-snapshots/**
`;

export const registry: Record<string, Check> = {
  hello: helloCheck,
  lint: scriptCheck('lint', 'lint'),
  typecheck: scriptCheck('typecheck', 'typecheck'),
  unit: scriptCheck('unit', 'test:unit'),
  integration: scriptCheck('integration', 'test:integration'),

  coverage: scriptCheck('coverage', 'test:coverage', undefined, {
    packages: ['@vitest/coverage-v8'],
  }),

  e2e: scriptCheck('e2e', 'test:e2e', 'test-results', {
    packages: ['@playwright/test'],
    script: { name: 'test:e2e', command: 'playwright test --project=e2e' },
    postInstall: 'npx playwright install chromium',
    files: [{ path: 'playwright.config.ts', content: PLAYWRIGHT_CONFIG }],
  }),

  a11y: scriptCheck('a11y', 'test:a11y', undefined, {
    packages: ['@axe-core/playwright'],
    script: { name: 'test:a11y', command: 'playwright test --project=a11y' },
  }),

  visual: scriptCheck('visual', 'test:visual', 'test-results', {
    script: { name: 'test:visual', command: 'playwright test --project=visual' },
  }),

  audit: scriptCheck('audit', 'security:audit', undefined, {
    script: { name: 'security:audit', command: 'npm audit --audit-level=high' },
  }),

  secrets: scriptCheck('secrets', 'security:secrets', undefined, {
    packages: ['secretlint', '@secretlint/secretlint-rule-preset-recommend'],
    script: { name: 'security:secrets', command: 'secretlint --secretlintignore .secretlintignore "src/**/*.ts"' },
    files: [
      { path: '.secretlintrc.json', content: SECRETLINT_CONFIG },
      { path: '.secretlintignore', content: SECRETLINT_IGNORE },
    ],
  }),
};
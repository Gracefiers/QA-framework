import type { Check } from '../core/types';
import { helloCheck } from './hello';
import { scriptCheck } from './script';
import {
  A11Y_SPEC,
  E2E_SPEC,
  ESLINT_CONFIG,
  LIGHTHOUSE_SCRIPT,
  PLAYWRIGHT_CONFIG,
  SECRETLINT_CONFIG,
  SECRETLINT_IGNORE,
  SIZE_LIMIT_CONFIG,
  TSCONFIG,
  VISUAL_SPEC,
  VITEST_CONFIG,
} from '../core/templates';

export const registry: Record<string, Check> = {
  hello: helloCheck,

  lint: scriptCheck('lint', 'lint', undefined, {
    packages: ['eslint', '@eslint/js', 'typescript-eslint'],
    scripts: [{ name: 'lint', command: 'eslint src' }],
    files: [{ path: 'eslint.config.js', content: ESLINT_CONFIG }],
  }),

  typecheck: scriptCheck('typecheck', 'typecheck', undefined, {
    packages: ['typescript', '@types/node'],
    scripts: [{ name: 'typecheck', command: 'tsc --noEmit' }],
    files: [{ path: 'tsconfig.json', content: TSCONFIG }],
  }),

  unit: scriptCheck('unit', 'test:unit', undefined, {
    packages: ['vitest'],
    scripts: [{ name: 'test:unit', command: 'vitest run --dir src' }],
    files: [{ path: 'vitest.config.ts', content: VITEST_CONFIG }],
  }),

  integration: scriptCheck('integration', 'test:integration'),

  coverage: scriptCheck('coverage', 'test:coverage', undefined, {
    packages: ['vitest', '@vitest/coverage-v8'],
    scripts: [{ name: 'test:coverage', command: 'vitest run --coverage' }],
    files: [{ path: 'vitest.config.ts', content: VITEST_CONFIG }],
  }),

  e2e: scriptCheck('e2e', 'test:e2e', 'test-results', {
    packages: ['@playwright/test'],
    scripts: [{ name: 'test:e2e', command: 'playwright test --project=e2e' }],
    postInstall: 'npx playwright install chromium',
    files: [
      { path: 'playwright.config.ts', content: PLAYWRIGHT_CONFIG },
      { path: 'e2e/accueil.spec.ts', content: E2E_SPEC },
    ],
  }),

  a11y: scriptCheck('a11y', 'test:a11y', undefined, {
    packages: ['@playwright/test', '@axe-core/playwright'],
    scripts: [{ name: 'test:a11y', command: 'playwright test --project=a11y' }],
    files: [
      { path: 'playwright.config.ts', content: PLAYWRIGHT_CONFIG },
      { path: 'e2e/a11y/accueil.a11y.spec.ts', content: A11Y_SPEC },
    ],
  }),

  visual: scriptCheck('visual', 'test:visual', 'test-results', {
    packages: ['@playwright/test'],
    scripts: [{ name: 'test:visual', command: 'playwright test --project=visual' }],
    files: [
      { path: 'playwright.config.ts', content: PLAYWRIGHT_CONFIG },
      { path: 'e2e/visual/accueil.visual.spec.ts', content: VISUAL_SPEC },
    ],
  }),

  audit: scriptCheck('audit', 'security:audit', undefined, {
    scripts: [{ name: 'security:audit', command: 'npm audit --audit-level=high' }],
  }),

  secrets: scriptCheck('secrets', 'security:secrets', undefined, {
    packages: ['secretlint', '@secretlint/secretlint-rule-preset-recommend'],
    scripts: [{ name: 'security:secrets', command: 'secretlint --secretlintignore .secretlintignore src/**/*.ts' }],
    files: [
      { path: '.secretlintrc.json', content: SECRETLINT_CONFIG },
      { path: '.secretlintignore', content: SECRETLINT_IGNORE },
    ],
  }),

  bundle: scriptCheck('bundle', 'perf:bundle', undefined, {
    packages: ['size-limit', '@size-limit/file'],
    scripts: [{ name: 'perf:bundle', command: 'npm run build && size-limit' }],
    files: [{ path: '.size-limit.json', content: SIZE_LIMIT_CONFIG }],
  }),

  lighthouse: scriptCheck('lighthouse', 'perf:lighthouse', undefined, {
    packages: ['lighthouse', 'chrome-launcher', 'start-server-and-test'],
    scripts: [
      { name: 'perf:lighthouse:run', command: 'node perf-lighthouse.mjs' },
      {
        name: 'perf:lighthouse',
        command: 'npm run build && start-server-and-test preview http://localhost:4173 perf:lighthouse:run',
      },
    ],
    files: [{ path: 'perf-lighthouse.mjs', content: LIGHTHOUSE_SCRIPT }],
  }),
};

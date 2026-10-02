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

const SIZE_LIMIT_CONFIG = `[
  {
    "name": "JS de l'application",
    "path": "dist/assets/*.js",
    "limit": "150 KB"
  }
]
`;

const LIGHTHOUSE_SCRIPT = `import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const URL_A_TESTER = 'http://localhost:4173';
const SEUIL = 0.8;

const chrome = await launch({ chromeFlags: ['--headless'] });

try {
  const resultat = await lighthouse(URL_A_TESTER, {
    port: chrome.port,
    onlyCategories: ['performance'],
    output: 'json',
  });

  const score = resultat.lhr.categories.performance.score;
  const scoreSur100 = Math.round(score * 100);

  console.log(\`Score de performance Lighthouse : \${scoreSur100}/100 (seuil : \${SEUIL * 100})\`);

  if (score < SEUIL) {
    console.error(\`Échec : le score (\${scoreSur100}) est sous le seuil (\${SEUIL * 100}).\`);
    process.exitCode = 1;
  }
} finally {
  await chrome.kill();
}
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
    scripts: [{ name: 'test:e2e', command: 'playwright test --project=e2e' }],
    postInstall: 'npx playwright install chromium',
    files: [{ path: 'playwright.config.ts', content: PLAYWRIGHT_CONFIG }],
  }),

  a11y: scriptCheck('a11y', 'test:a11y', undefined, {
    packages: ['@axe-core/playwright'],
    scripts: [{ name: 'test:a11y', command: 'playwright test --project=a11y' }],
  }),

  visual: scriptCheck('visual', 'test:visual', 'test-results', {
    scripts: [{ name: 'test:visual', command: 'playwright test --project=visual' }],
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
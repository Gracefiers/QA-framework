export const QA_CONFIG = `{
  "projectType": "web",
  "checks": {
    "lint": { "enabled": true, "required": true },
    "typecheck": { "enabled": true, "required": true },
    "unit": { "enabled": true, "required": true },
    "coverage": { "enabled": true, "required": true },
    "e2e": { "enabled": true, "required": true },
    "a11y": { "enabled": true, "required": false },
    "visual": { "enabled": true, "required": false },
    "audit": { "enabled": true, "required": true },
    "secrets": { "enabled": true, "required": true },
    "bundle": { "enabled": true, "required": false },
    "lighthouse": { "enabled": true, "required": false }
  }
}
`;

export const ESLINT_CONFIG = `import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [js.configs.recommended, ...tseslint.configs.recommended];
`;

export const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src"]
}
`;

export const VITEST_CONFIG = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
`;

export const PLAYWRIGHT_CONFIG = `import { defineConfig } from '@playwright/test';

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

export const E2E_SPEC = `import { test, expect } from '@playwright/test';

test('la page d\\'accueil se charge', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
`;

export const A11Y_SPEC = `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('la page d\\'accueil ne viole aucune règle WCAG critique', async ({ page }) => {
  await page.goto('/');
  const resultats = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(resultats.violations, JSON.stringify(resultats.violations, null, 2)).toEqual([]);
});
`;

export const VISUAL_SPEC = `import { test, expect } from '@playwright/test';

test('la page d\\'accueil correspond au snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('accueil.png', { fullPage: true });
});
`;

export const SECRETLINT_CONFIG = `{
  "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }]
}
`;

export const SECRETLINT_IGNORE = `node_modules/**
dist/**
coverage/**
.qa/**
playwright-report/**
test-results/**
package-lock.json
**/*-snapshots/**
`;

export const SIZE_LIMIT_CONFIG = `[
  {
    "name": "JS de l'application",
    "path": "dist/assets/*.js",
    "limit": "150 KB"
  }
]
`;

export const LIGHTHOUSE_SCRIPT = `import { launch } from 'chrome-launcher';
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

export const GITIGNORE_LINES = [
  'node_modules/',
  'dist/',
  'coverage/',
  '.qa/',
  'playwright-report/',
  'test-results/',
];

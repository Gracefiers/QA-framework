import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProfilApp } from './stack';

export const QA_CONFIG = `{
  "projectType": "web",
  "publicPath": "/",
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

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      '.qa/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
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

export const COMMANDE_UNIT_NODE = 'tsx --test --test-reporter spec "src/**/*.test.ts"';
export const COMMANDE_COVERAGE_NODE = 'tsx --test --experimental-test-coverage --test-reporter spec "src/**/*.test.ts"';

function parserJsonSouple(texte: string): unknown {
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(sansCommentaires.replace(/,\s*([}\]])/g, '$1'));
}

function aliasTsconfig(cwd: string): { find: string; replacement: string }[] {
  const chemin = join(cwd, 'tsconfig.json');
  if (!existsSync(chemin)) return [];
  let lu: unknown;
  try {
    lu = parserJsonSouple(readFileSync(chemin, 'utf8'));
  } catch {
    return [];
  }
  const paths = (lu as { compilerOptions?: { paths?: Record<string, string[]> } }).compilerOptions?.paths;
  if (!paths) return [];

  const alias = [];
  for (const [cle, cibles] of Object.entries(paths)) {
    const cible = cibles?.[0];
    if (!cible) continue;
    const find = cle.endsWith('/*') ? cle.slice(0, -2) : cle;
    let replacement = cible.endsWith('/*') ? cible.slice(0, -2) : cible;
    if (!replacement.startsWith('./') && !replacement.startsWith('../')) replacement = `./${replacement}`;
    alias.push({ find, replacement });
  }
  return alias;
}

export function configVitest(cwd: string): string {
  const alias = aliasTsconfig(cwd);
  const seuils = existsSync(join(cwd, 'coverage', 'coverage-summary.json'));
  const importUrl = alias.length ? "import { fileURLToPath } from 'node:url';\n" : '';
  const resolve = alias.length
    ? `  resolve: {\n    alias: [\n${alias
        .map(
          (a) =>
            `      { find: ${JSON.stringify(a.find)}, replacement: fileURLToPath(new URL(${JSON.stringify(a.replacement)}, import.meta.url)) },`,
        )
        .join('\n')}\n    ],\n  },\n`
    : '';
  const thresholds = seuils
    ? '\n      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },'
    : '';

  return `import { defineConfig } from 'vitest/config';
${importUrl}export default defineConfig({
${resolve}  test: {
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'json-summary'],${thresholds}
    },
  },
});
`;
}

export function configPlaywright(profil: ProfilApp): string {
  const base = `http://localhost:${profil.port}`;
  const env = [
    `PORT: '${profil.port}'`,
    ...profil.clesSso.map((cle) => `${cle}: ''`),
  ].join(',\n      ');
  return `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: '${base}',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: '${base}',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ${env},
    },
  },
  projects: [
    { name: 'e2e', testIgnore: ['**/a11y/**', '**/visual/**'] },
    { name: 'a11y', testMatch: ['**/a11y/**/*.spec.ts'] },
    { name: 'visual', testMatch: ['**/visual/**/*.spec.ts'] },
  ],
});
`;
}

export const CHEMIN_PUBLIC = `import { readFileSync } from 'node:fs';

export function cheminPublic(): string {
  try {
    const config = JSON.parse(readFileSync('qa.config.json', 'utf8'));
    if (typeof config.publicPath === 'string' && config.publicPath.length > 0) {
      return config.publicPath;
    }
  } catch {
    // qa.config.json absent ou illisible : on teste la page d'accueil.
  }
  return '/';
}
`;

export const E2E_SPEC = `import { test, expect } from '@playwright/test';
import { cheminPublic } from './chemin-public';

test('la page d\\'accueil se charge', async ({ page }) => {
  await page.goto(cheminPublic());
  await expect(page).toHaveTitle(/.+/);
});
`;

export const A11Y_SPEC = `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cheminPublic } from '../chemin-public';

test('la page d\\'accueil ne viole aucune règle WCAG critique', async ({ page }) => {
  await page.goto(cheminPublic());
  const resultats = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(resultats.violations, JSON.stringify(resultats.violations, null, 2)).toEqual([]);
});
`;

export const VISUAL_SPEC = `import { test, expect } from '@playwright/test';
import { cheminPublic } from '../chemin-public';

test('la page d\\'accueil correspond au snapshot', async ({ page }) => {
  await page.goto(cheminPublic());
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

export function configTaille(profil: ProfilApp): string {
  return `${JSON.stringify(
    [{ name: "JS de l'application", path: profil.cheminBundle, limit: profil.limiteBundle }],
    null,
    2,
  )}\n`;
}

export const LIGHTHOUSE_SCRIPT = `import { readFileSync } from 'node:fs';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

function cheminPublic() {
  try {
    const config = JSON.parse(readFileSync('qa.config.json', 'utf8'));
    if (typeof config.publicPath === 'string' && config.publicPath.length > 0) {
      return config.publicPath;
    }
  } catch {
    // qa.config.json absent ou illisible : on mesure la page d'accueil.
  }
  return '/';
}

const URL_A_TESTER = new URL(cheminPublic(), 'http://localhost:4173').href;
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

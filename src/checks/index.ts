import type { Check, ContextePreparation, FichierRequis } from '../core/types';
import { helloCheck } from './hello';
import { scriptCheck } from './script';
import { auditCheck } from './audit';
import { chromiumManquant } from '../core/setup';
import {
  A11Y_SPEC,
  CHEMIN_PUBLIC,
  E2E_SPEC,
  ESLINT_CONFIG,
  LIGHTHOUSE_SCRIPT,
  SECRETLINT_CONFIG,
  SECRETLINT_IGNORE,
  TSCONFIG,
  VISUAL_SPEC,
  configPlaywright,
  configTaille,
  configVitest,
} from '../core/templates';

const FICHIERS_PLAYWRIGHT: FichierRequis[] = [
  { path: 'playwright.config.ts', content: ({ stack }) => configPlaywright(stack) },
  { path: 'e2e/chemin-public.ts', content: CHEMIN_PUBLIC },
];

const INSTALL_CHROMIUM = {
  postInstall: 'npx playwright install chromium',
  postInstallSi: chromiumManquant,
};

function fichiersVitest({ cwd, stack }: ContextePreparation): FichierRequis[] {
  if (stack.runnerTests === 'node') return [];
  return [{ path: 'vitest.config.ts', content: configVitest(cwd) }];
}

export const registry: Record<string, Check> = {
  hello: helloCheck,

  lint: scriptCheck('lint', 'lint', undefined, {
    packages: ['eslint', '@eslint/js', 'typescript-eslint'],
    scripts: ({ stack }) => [{ name: 'lint', command: stack.commandeLint }],
    files: [
      {
        path: 'eslint.config.js',
        content: ESLINT_CONFIG,
        ecrireSi: ({ stack }) => stack.configEslint === null,
      },
    ],
  }),

  typecheck: scriptCheck('typecheck', 'typecheck', undefined, {
    packages: ['typescript', '@types/node'],
    scripts: [{ name: 'typecheck', command: 'tsc --noEmit' }],
    files: [{ path: 'tsconfig.json', content: TSCONFIG }],
  }),

  unit: scriptCheck('unit', 'test:unit', undefined, {
    packages: ({ stack }) => (stack.runnerTests === 'node' ? ['tsx'] : [stack.paquetVitest]),
    scripts: ({ stack }) => [{ name: 'test:unit', command: stack.commandeUnit }],
    files: fichiersVitest,
  }),

  integration: scriptCheck('integration', 'test:integration'),

  coverage: scriptCheck('coverage', 'test:coverage', undefined, {
    packages: ({ stack }) =>
      stack.runnerTests === 'node' ? ['tsx'] : [stack.paquetVitest, stack.paquetCouverture],
    scripts: ({ stack }) => [{ name: 'test:coverage', command: stack.commandeCoverage }],
    files: fichiersVitest,
  }),

  e2e: scriptCheck('e2e', 'test:e2e', 'test-results', {
    packages: ['@playwright/test'],
    scripts: [{ name: 'test:e2e', command: 'playwright test --project=e2e' }],
    ...INSTALL_CHROMIUM,
    files: [...FICHIERS_PLAYWRIGHT, { path: 'e2e/accueil.spec.ts', content: E2E_SPEC }],
  }),

  a11y: scriptCheck('a11y', 'test:a11y', undefined, {
    packages: ['@playwright/test', '@axe-core/playwright'],
    scripts: [{ name: 'test:a11y', command: 'playwright test --project=a11y' }],
    ...INSTALL_CHROMIUM,
    files: [...FICHIERS_PLAYWRIGHT, { path: 'e2e/a11y/accueil.a11y.spec.ts', content: A11Y_SPEC }],
  }),

  visual: scriptCheck('visual', 'test:visual', 'test-results', {
    packages: ['@playwright/test'],
    scripts: [{ name: 'test:visual', command: 'playwright test --project=visual' }],
    ...INSTALL_CHROMIUM,
    files: [...FICHIERS_PLAYWRIGHT, { path: 'e2e/visual/accueil.visual.spec.ts', content: VISUAL_SPEC }],
  }),

  audit: auditCheck,

  secrets: scriptCheck('secrets', 'security:secrets', undefined, {
    packages: ['secretlint', '@secretlint/secretlint-rule-preset-recommend'],
    scripts: ({ stack }) => [{ name: 'security:secrets', command: stack.commandeSecrets }],
    files: [
      { path: '.secretlintrc.json', content: SECRETLINT_CONFIG },
      { path: '.secretlintignore', content: SECRETLINT_IGNORE },
    ],
  }),

  bundle: scriptCheck('bundle', 'perf:bundle', undefined, {
    packages: ['size-limit', '@size-limit/file'],
    scripts: [{ name: 'perf:bundle', command: 'npm run build && size-limit' }],
    files: [{ path: '.size-limit.json', content: ({ stack }) => configTaille(stack) }],
  }),

  lighthouse: scriptCheck('lighthouse', 'perf:lighthouse', undefined, {
    packages: ['lighthouse', 'chrome-launcher', 'start-server-and-test'],
    scripts: ({ stack }) => [
      { name: 'preview', command: stack.commandePreview },
      { name: 'perf:lighthouse:run', command: 'node perf-lighthouse.mjs' },
      {
        name: 'perf:lighthouse',
        command: 'npm run build && start-server-and-test preview http://localhost:4173 perf:lighthouse:run',
      },
    ],
    files: [{ path: 'perf-lighthouse.mjs', content: LIGHTHOUSE_SCRIPT }],
  }),
};

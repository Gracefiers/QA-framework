import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { registry } from '../checks';
import { loadConfig } from '../config';
import type { ContextePreparation } from './types';
import { ESLINT_CONFIG, LIGHTHOUSE_SCRIPT, configPlaywright, configTaille, configVitest } from './templates';
import { detecterProfil } from './stack';
import { ensureReady } from './setup';

const dossiers: string[] = [];

function projet(packageJson: Record<string, unknown>): string {
  const dossier = mkdtempSync(join(tmpdir(), 'qa-profil-'));
  dossiers.push(dossier);
  writeFileSync(join(dossier, 'package.json'), JSON.stringify(packageJson));
  return dossier;
}

afterEach(() => {
  for (const dossier of dossiers.splice(0)) {
    rmSync(dossier, { recursive: true, force: true });
  }
});

describe('detecterProfil', () => {
  it('reconnaît Next, le port 3000 et un test node:test', () => {
    const dossier = projet({ dependencies: { next: '15.3.0' } });
    mkdirSync(join(dossier, 'src'));
    writeFileSync(join(dossier, 'src', 'envoi.test.ts'), "import { test } from 'node:test';\n");
    writeFileSync(join(dossier, 'eslint.config.mjs'), 'export default [];\n');

    const profil = detecterProfil(dossier);

    expect(profil.framework).toBe('next');
    expect(profil.port).toBe(3000);
    expect(profil.commandePreview).toBe('next start -p 4173');
    expect(profil.cheminBundle).toBe('.next/static/chunks/**/*.js');
    expect(profil.limiteBundle).toBe('5 MB');
    expect(profil.runnerTests).toBe('node');
    expect(profil.configEslint).toBe('eslint.config.mjs');
  });

  it('reconnaît Vite sur le port 5173', () => {
    const dossier = projet({ devDependencies: { vite: '6.0.0' } });

    const profil = detecterProfil(dossier);

    expect(profil.framework).toBe('vite');
    expect(profil.port).toBe(5173);
    expect(profil.cheminBundle).toBe('dist/assets/*.js');
    expect(profil.runnerTests).toBe('vitest');
    expect(profil.paquetVitest).toBe('vitest');
    expect(profil.configEslint).toBeNull();
  });

  it('choisit Vitest 4 quand @types/node est en version 20', () => {
    const dossier = projet({
      dependencies: { next: '16.2.4' },
      devDependencies: { '@types/node': '^20' },
    });

    const profil = detecterProfil(dossier);
    const paquet = registry.unit.requirement?.packages;
    const paquets = typeof paquet === 'function' ? paquet({ cwd: dossier, stack: profil }) : paquet;

    expect(profil.runnerTests).toBe('vitest');
    expect(paquets).toEqual(['vitest@4']);
    expect(profil.paquetCouverture).toBe('@vitest/coverage-v8@4');
  });
});

describe('ensureReady', () => {
  it('écrit une config ESLint qui ignore les dossiers générés', async () => {
    const dossier = projet({ name: 'app' });

    await ensureReady(dossier, 'lint', {
      files: [
        {
          path: 'eslint.config.js',
          content: ESLINT_CONFIG,
          ecrireSi: ({ stack }) => stack.configEslint === null,
        },
      ],
    });

    const ecrit = readFileSync(join(dossier, 'eslint.config.js'), 'utf8');
    expect(ecrit).toContain('node_modules/**');
    expect(ecrit).toContain('.next/**');
    expect(ecrit).toContain('playwright-report/**');
  });

  it('ne crée pas eslint.config.js si eslint.config.mjs existe déjà', async () => {
    const dossier = projet({ name: 'app' });
    writeFileSync(join(dossier, 'eslint.config.mjs'), 'export default [];\n');

    await ensureReady(dossier, 'lint', {
      files: [
        {
          path: 'eslint.config.js',
          content: ESLINT_CONFIG,
          ecrireSi: ({ stack }) => stack.configEslint === null,
        },
      ],
    });

    expect(readFileSync(join(dossier, 'eslint.config.mjs'), 'utf8')).toBe('export default [];\n');
    expect(existsSync(join(dossier, 'eslint.config.js'))).toBe(false);
  });

  it('écrit Playwright sur le port de la stack', async () => {
    const dossier = projet({ dependencies: { next: '15.3.0' } });

    await ensureReady(dossier, 'e2e', {
      files: [
        {
          path: 'playwright.config.ts',
          content: ({ stack }) => `baseURL: 'http://localhost:${stack.port}'`,
        },
      ],
    });

    expect(readFileSync(join(dossier, 'playwright.config.ts'), 'utf8')).toBe("baseURL: 'http://localhost:3000'");
  });

  it('ne réécrit pas un fichier déjà présent', async () => {
    const dossier = projet({ dependencies: { next: '15.3.0' } });
    writeFileSync(join(dossier, 'playwright.config.ts'), 'deja la');

    await ensureReady(dossier, 'e2e', {
      files: [
        {
          path: 'playwright.config.ts',
          content: ({ stack }) => `port ${stack.port}`,
        },
      ],
    });

    expect(readFileSync(join(dossier, 'playwright.config.ts'), 'utf8')).toBe('deja la');
  });
});

function resoudre<T>(valeur: T | ((ctx: ContextePreparation) => T) | undefined, ctx: ContextePreparation): T | undefined {
  if (typeof valeur === 'function') return (valeur as (ctx: ContextePreparation) => T)(ctx);
  return valeur;
}

describe('tests, bundle et lighthouse', () => {
  it('prend le runner Node et n écrit pas de config Vitest', () => {
    const dossier = projet({ dependencies: { next: '15.3.0' } });
    mkdirSync(join(dossier, 'src'));
    writeFileSync(join(dossier, 'src', 'envoi.test.ts'), "import { test } from 'node:test';\n");
    const ctx = { cwd: dossier, stack: detecterProfil(dossier) };

    expect(resoudre(registry.unit.requirement?.scripts, ctx)).toEqual([
      { name: 'test:unit', command: 'tsx --test --test-reporter spec "src/**/*.test.ts"' },
    ]);
    expect(resoudre(registry.coverage.requirement?.scripts, ctx)?.[0].command).toContain('--experimental-test-coverage');
    expect(resoudre(registry.unit.requirement?.files, ctx)).toEqual([]);
    expect(resoudre(registry.lighthouse.requirement?.scripts, ctx)?.[0]).toEqual({
      name: 'preview',
      command: 'next start -p 4173',
    });
  });

  it('reprend les tests node:test hors de src et le script npm test déjà présent', () => {
    const dossier = projet({
      devDependencies: { vite: '7.0.0' },
      scripts: { test: 'tsx --test server/*.test.ts shared/*.test.ts' },
    });
    mkdirSync(join(dossier, 'server'));
    writeFileSync(join(dossier, 'server', 'uploads.test.ts'), 'import { it } from "node:test";\n');
    const profil = detecterProfil(dossier);

    expect(profil.runnerTests).toBe('node');
    expect(profil.commandeUnit).toBe('tsx --test server/*.test.ts shared/*.test.ts');
    expect(profil.commandeCoverage).toBe(
      'tsx --test --experimental-test-coverage server/*.test.ts shared/*.test.ts',
    );
  });

  it('écrit une config Vitest avec l alias @ et sans seuil au premier passage', () => {
    const dossier = projet({ devDependencies: { vite: '6.0.0' } });
    writeFileSync(
      join(dossier, 'tsconfig.json'),
      '{\n  // alias applicatif\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },\n}\n',
    );

    const config = configVitest(dossier);
    expect(config).toContain('find: "@"');
    expect(config).toContain("new URL(\"./src\", import.meta.url)");
    expect(config).not.toContain('thresholds');

    mkdirSync(join(dossier, 'coverage'));
    writeFileSync(join(dossier, 'coverage', 'coverage-summary.json'), '{}');
    expect(configVitest(dossier)).toContain('thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }');
  });

  it('décrit une app Express + Vite comme fiers-commande', () => {
    const dossier = projet({
      devDependencies: { vite: '7.0.0' },
      scripts: {
        start: 'cross-env NODE_ENV=production node dist/index.cjs',
        'test:auth': 'tsx --test server/auth-config.test.ts',
      },
    });
    mkdirSync(join(dossier, 'client', 'src'), { recursive: true });
    mkdirSync(join(dossier, 'server'));
    mkdirSync(join(dossier, 'shared'));
    writeFileSync(join(dossier, 'server', 'index.ts'), 'const port = parseInt(process.env.PORT || "5000", 10);\n');
    writeFileSync(join(dossier, 'server', 'auth-config.test.ts'), 'import { it } from "node:test";\n');
    writeFileSync(join(dossier, 'shared', 'coffrets.test.ts'), 'import { it } from "node:test";\n');
    writeFileSync(
      join(dossier, 'vite.config.ts'),
      'export default { build: { outDir: path.resolve(import.meta.dirname, "dist/public") } };\n',
    );
    writeFileSync(join(dossier, '.env'), 'FORMS_OIDC_CLIENT_ID=secret-ne-pas-copier\nPORT=5000\n');

    const profil = detecterProfil(dossier);

    expect(profil.port).toBe(5000);
    expect(profil.sources).toEqual(['client/src', 'server', 'shared']);
    expect(profil.commandeLint).toBe('eslint client/src server shared');
    expect(profil.commandeSecrets).toContain('"server/**/*.ts"');
    expect(profil.commandeSecrets).toContain('"shared/**/*.tsx"');
    expect(profil.commandeUnit).toBe(
      'tsx --test --test-reporter spec "server/**/*.test.ts" "shared/**/*.test.ts"',
    );
    expect(profil.cheminBundle).toBe('dist/public/assets/*.js');
    expect(profil.limiteBundle).toBe('250 KB');
    expect(profil.commandePreview).toBe('cross-env PORT=4173 NODE_ENV=production node dist/index.cjs');
    expect(profil.clesSso).toEqual(['FORMS_OIDC_CLIENT_ID']);

    const playwright = configPlaywright(profil);
    expect(playwright).toContain('http://localhost:5000');
    expect(playwright).toContain('reuseExistingServer: false');
    expect(playwright).toContain("PORT: '5000'");
    expect(playwright).toContain("FORMS_OIDC_CLIENT_ID: ''");
    expect(playwright).not.toContain('secret-ne-pas-copier');
  });

  it('cible le dossier de build Next pour size-limit et le chemin public pour Lighthouse', () => {
    const dossier = projet({ dependencies: { next: '15.3.0' } });
    const taille = configTaille(detecterProfil(dossier));
    expect(taille).toContain('.next/static/chunks/**/*.js');
    expect(taille).toContain('5 MB');
    expect(LIGHTHOUSE_SCRIPT).toContain("new URL(cheminPublic(), 'http://localhost:4173')");
  });

  it('conserve les guillemets du glob dans package.json', async () => {
    const dossier = projet({ name: 'app' });
    await ensureReady(dossier, 'unit', {
      scripts: [{ name: 'test:unit', command: 'tsx --test --test-reporter spec "src/**/*.test.ts"' }],
    });
    const pkg = JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:unit']).toBe('tsx --test --test-reporter spec "src/**/*.test.ts"');
  });
});

describe('loadConfig', () => {
  it('prend / quand publicPath est absent', () => {
    const dossier = projet({});
    writeFileSync(
      join(dossier, 'qa.config.json'),
      JSON.stringify({ projectType: 'web', checks: { lint: { enabled: true, required: true } } }),
    );

    expect(loadConfig(dossier).publicPath).toBe('/');
  });
});

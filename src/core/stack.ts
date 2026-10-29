import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { COMMANDE_COVERAGE_NODE, COMMANDE_UNIT_NODE } from './templates';

export type FrameworkApp = 'next' | 'vite' | 'autre';
export type RunnerTests = 'node' | 'vitest';

export interface ProfilApp {
  framework: FrameworkApp;
  port: number;
  commandePreview: string;
  cheminBundle: string;
  limiteBundle: string;
  runnerTests: RunnerTests;
  commandeUnit: string;
  commandeCoverage: string;
  paquetVitest: string;
  paquetCouverture: string;
  sources: string[];
  commandeLint: string;
  commandeSecrets: string;
  clesSso: string[];
  configEslint: string | null;
}

const CONFIGS_ESLINT = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'];

const DOSSIERS_IGNORES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.qa',
  '.next',
  'playwright-report',
  'test-results',
]);

const SCRIPT_NODE = /(?:^|\s)(?:tsx|node)(?:\.cmd)?\s+--test\b/;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function lirePackageJson(cwd: string): PackageJson {
  const chemin = join(cwd, 'package.json');
  if (!existsSync(chemin)) {
    throw new Error(`package.json introuvable dans ${cwd}`);
  }
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

function configEslintExistante(cwd: string): string | null {
  return CONFIGS_ESLINT.find((nom) => existsSync(join(cwd, nom))) ?? null;
}

const RACINES_CONNUES = ['client/src', 'server', 'shared', 'src'];

function sourcesDuProjet(cwd: string): string[] {
  const presentes = ['client/src', 'server', 'shared'].filter((s) => existsSync(join(cwd, s)));
  if (presentes.length) return presentes;
  return ['src'];
}

function commandeLint(sources: string[]): string {
  return `eslint ${sources.join(' ')}`;
}

function commandeSecrets(sources: string[]): string {
  const globs = sources.flatMap((s) => [`"${s}/**/*.ts"`, `"${s}/**/*.tsx"`]);
  return `secretlint --secretlintignore .secretlintignore ${globs.join(' ')}`;
}

function portServeur(cwd: string): number | null {
  const chemin = join(cwd, 'server', 'index.ts');
  if (!existsSync(chemin)) return null;
  const trouve = readFileSync(chemin, 'utf8').match(/PORT\s*\|\|\s*["'](\d+)["']/);
  return trouve ? Number(trouve[1]) : null;
}

function bundleVite(cwd: string): { cheminBundle: string; limiteBundle: string } {
  const chemin = join(cwd, 'vite.config.ts');
  if (!existsSync(chemin)) return { cheminBundle: 'dist/assets/*.js', limiteBundle: '150 KB' };
  const trouve = readFileSync(chemin, 'utf8').match(
    /outDir:\s*(?:path\.resolve\([\s\S]*?["']([^"']+)["'][\s\S]*?\)|["']([^"']+)["'])/,
  );
  const out = (trouve?.[1] || trouve?.[2] || '').replace(/\\/g, '/');
  if (out.endsWith('dist/public')) return { cheminBundle: 'dist/public/assets/*.js', limiteBundle: '250 KB' };
  return { cheminBundle: 'dist/assets/*.js', limiteBundle: '150 KB' };
}

function apercu(pkg: PackageJson, framework: FrameworkApp): string {
  if ((pkg.scripts?.start ?? '').includes('dist/index.cjs')) {
    return 'cross-env PORT=4173 NODE_ENV=production node dist/index.cjs';
  }
  if (framework === 'next') return 'next start -p 4173';
  return 'vite preview --port 4173';
}

function clesSso(cwd: string): string[] {
  const chemin = join(cwd, '.env');
  if (!existsSync(chemin)) return [];
  const cles: string[] = [];
  for (const raw of readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const cle = line.slice(0, line.indexOf('=')).trim();
    if (/OIDC|ENTRA|SESSION_SECRET/i.test(cle)) cles.push(cle);
  }
  return cles;
}

function racinesTestsNode(cwd: string): string[] {
  const racines = new Set<string>();
  const dossiers = [cwd];
  while (dossiers.length) {
    const dossier = dossiers.pop()!;
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entree of entrees) {
      if (DOSSIERS_IGNORES.has(entree.name)) continue;
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        dossiers.push(chemin);
        continue;
      }
      if (!entree.isFile() || !/\.test\.tsx?$/.test(entree.name)) continue;
      if (!readFileSync(chemin, 'utf8').includes('node:test')) continue;
      const rel = relative(cwd, chemin).replace(/\\/g, '/');
      const racine =
        RACINES_CONNUES.find((s) => rel === s || rel.startsWith(`${s}/`)) ??
        rel.split('/').slice(0, -1).join('/');
      if (racine) racines.add(racine);
    }
  }
  return [...racines].sort();
}

function commandeDepuisRacines(racines: string[]): string {
  const globs = racines.map((r) => `"${r}/**/*.test.ts"`).join(' ');
  return `tsx --test --test-reporter spec ${globs}`;
}

function commandeNodeExistante(pkg: PackageJson): string | null {
  for (const nom of ['test:unit', 'test']) {
    const commande = pkg.scripts?.[nom];
    if (typeof commande === 'string' && SCRIPT_NODE.test(commande)) return commande;
  }
  return null;
}

function commandeCouverture(commandeUnit: string): string {
  if (commandeUnit.includes('--experimental-test-coverage')) return commandeUnit;
  if (commandeUnit.includes('--test')) return commandeUnit.replace('--test', '--test --experimental-test-coverage');
  return COMMANDE_COVERAGE_NODE;
}

function majeurTypesNode(pkg: PackageJson): number | null {
  const spec = pkg.devDependencies?.['@types/node'] ?? pkg.dependencies?.['@types/node'];
  const match = typeof spec === 'string' ? spec.match(/\d+/) : null;
  return match ? Number(match[0]) : null;
}

/** Vitest 5 exige @types/node 22+. Les dépôts encore en 18 ou 20 gardent une majeure compatible. */
function specsVitest(majeur: number | null): { paquetVitest: string; paquetCouverture: string } {
  if (majeur !== null && majeur <= 18) {
    return { paquetVitest: 'vitest@3', paquetCouverture: '@vitest/coverage-v8@3' };
  }
  if (majeur !== null && majeur < 22) {
    return { paquetVitest: 'vitest@4', paquetCouverture: '@vitest/coverage-v8@4' };
  }
  return { paquetVitest: 'vitest', paquetCouverture: '@vitest/coverage-v8' };
}

function champsTests(cwd: string, pkg: PackageJson): Pick<ProfilApp, 'runnerTests' | 'commandeUnit' | 'commandeCoverage' | 'paquetVitest' | 'paquetCouverture'> {
  const racines = racinesTestsNode(cwd);
  const existante = commandeNodeExistante(pkg);
  const runnerTests = racines.length || existante ? 'node' : 'vitest';
  const specs = specsVitest(majeurTypesNode(pkg));
  if (runnerTests === 'vitest') {
    return {
      runnerTests,
      commandeUnit: 'vitest run --dir src',
      commandeCoverage: 'vitest run --coverage',
      ...specs,
    };
  }
  const commandeUnit = existante ?? (racines.length ? commandeDepuisRacines(racines) : COMMANDE_UNIT_NODE);
  return { runnerTests, commandeUnit, commandeCoverage: commandeCouverture(commandeUnit), ...specs };
}

export function detecterProfil(cwd: string): ProfilApp {
  const pkg = lirePackageJson(cwd);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  const tests = champsTests(cwd, pkg);
  const configEslint = configEslintExistante(cwd);
  const sources = sourcesDuProjet(cwd);
  const framework: FrameworkApp = deps.next ? 'next' : deps.vite ? 'vite' : 'autre';
  const port = portServeur(cwd) ?? (framework === 'next' ? 3000 : 5173);
  const bundle = framework === 'next'
    ? { cheminBundle: '.next/static/chunks/**/*.js', limiteBundle: '5 MB' }
    : bundleVite(cwd);

  return {
    framework,
    port,
    commandePreview: apercu(pkg, framework),
    ...bundle,
    ...tests,
    sources,
    commandeLint: commandeLint(sources),
    commandeSecrets: commandeSecrets(sources),
    clesSso: clesSso(cwd),
    configEslint,
  };
}

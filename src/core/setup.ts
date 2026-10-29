import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import pc from 'picocolors';
import { exec, type ExecResult } from './exec';
import { createSpinner } from './spinner';
import { detecterProfil } from './stack';
import type { CheckRequirement, ContextePreparation, FichierRequis } from './types';

function selonProfil<T>(valeur: T | ((ctx: ContextePreparation) => T) | undefined, ctx: ContextePreparation): T | undefined {
  if (typeof valeur === 'function') return (valeur as (ctx: ContextePreparation) => T)(ctx);
  return valeur;
}

function commandePkgSet(name: string, command: string): string {
  const valeur = process.platform === 'win32' ? command.replaceAll('"', '""') : command.replaceAll('"', '\\"');
  return `npm pkg set "scripts.${name}=${valeur}"`;
}

function nomPaquet(spec: string): string {
  return spec.replace(/@[^@/]+$/, '');
}

function aLePaquet(cwd: string, spec: string): boolean {
  return existsSync(join(cwd, 'node_modules', ...nomPaquet(spec).split('/'), 'package.json'));
}

function lirePackageJson(cwd: string): any {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
}

const SCRIPT_CHROMIUM = `import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
process.exit(existsSync(chromium.executablePath()) ? 0 : 1);
`;

export async function chromiumManquant(cwd: string): Promise<boolean> {
  if (!aLePaquet(cwd, '@playwright/test')) return true;

  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', SCRIPT_CHROMIUM], {
      cwd,
      shell: false,
      stdio: 'ignore',
    });
    child.on('close', (c) => resolve(c ?? 1));
    child.on('error', () => resolve(1));
  });
  return code !== 0;
}

let spinner: ReturnType<typeof createSpinner> | null = null;

async function etape(label: string, commande: string, cwd: string): Promise<ExecResult> {
  const tourne = Boolean(process.stdout.isTTY);
  if (tourne) {
    spinner ??= createSpinner();
    spinner.start(label);
  } else {
    console.log(pc.dim(label));
  }
  try {
    return await exec(commande, cwd);
  } finally {
    if (tourne && spinner) {
      spinner.stop();
      console.log(pc.dim(label));
    }
  }
}

function contenuFichier(fichier: FichierRequis, ctx: ContextePreparation): string {
  return typeof fichier.content === 'function' ? fichier.content(ctx) : fichier.content;
}

export async function ensureReady(cwd: string, id: string, req?: CheckRequirement): Promise<void> {
  if (!req) return;

  const ctx: ContextePreparation = { cwd, stack: detecterProfil(cwd) };

  const paquets = selonProfil(req.packages, ctx) ?? [];
  const scripts = selonProfil(req.scripts, ctx) ?? [];
  const fichiers = selonProfil(req.files, ctx) ?? [];

  const manquants = paquets.filter((p) => !aLePaquet(cwd, p));
  if (manquants.length) {
    const labelInstall = `📦 [${id}] installation de ${manquants.join(', ')}…`;
    const { code, output } = await etape(labelInstall, `npm i -D ${manquants.join(' ')}`, cwd);
    if (code !== 0) throw new Error(`Échec de l'installation pour "${id}" :\n${output}`);
  }

  if (req.postInstall) {
    const lancer = manquants.length > 0 || (req.postInstallSi ? await req.postInstallSi(cwd) : false);
    if (lancer) {
      const labelPost = `📦 [${id}] ${req.postInstall}`;
      const { code, output } = await etape(labelPost, req.postInstall, cwd);
      if (code !== 0) throw new Error(`Échec de « ${req.postInstall} » pour "${id}" :\n${output}`);
    }
  }

  for (const s of scripts) {
    const pkgJson = lirePackageJson(cwd);
    if (!pkgJson.scripts?.[s.name]) {
      const labelScript = `📝 [${id}] ajout du script "${s.name}"`;
      const { code, output } = await etape(labelScript, commandePkgSet(s.name, s.command), cwd);
      if (code !== 0) throw new Error(`Échec de l'ajout du script "${s.name}" pour "${id}" :\n${output}`);
    }
  }

  for (const f of fichiers) {
    if (f.ecrireSi && !f.ecrireSi(ctx)) continue;
    const chemin = join(cwd, f.path);
    if (!existsSync(chemin)) {
      console.log(pc.dim(`📝 [${id}] création de ${f.path}`));
      mkdirSync(dirname(chemin), { recursive: true });
      writeFileSync(chemin, contenuFichier(f, ctx));
    }
  }
}

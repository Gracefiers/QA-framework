import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import pc from 'picocolors';
import { exec } from './exec';
import type { CheckRequirement } from './types';

function aLePaquet(cwd: string, pkg: string): boolean {
  return existsSync(join(cwd, 'node_modules', ...pkg.split('/'), 'package.json'));
}

function lirePackageJson(cwd: string): any {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
}

export async function ensureReady(cwd: string, id: string, req?: CheckRequirement): Promise<void> {
  if (!req) return;

  const manquants = (req.packages ?? []).filter((p) => !aLePaquet(cwd, p));
  if (manquants.length) {
    console.log(pc.dim(`📦 [${id}] installation de ${manquants.join(', ')}…`));
    const { code, output } = await exec(`npm i -D ${manquants.join(' ')}`, cwd);
    if (code !== 0) throw new Error(`Échec de l'installation pour "${id}" :\n${output}`);

    if (req.postInstall) {
      console.log(pc.dim(`📦 [${id}] ${req.postInstall}`));
      await exec(req.postInstall, cwd);
    }
  }

  if (req.script) {
    const pkgJson = lirePackageJson(cwd);
    if (!pkgJson.scripts?.[req.script.name]) {
      console.log(pc.dim(`📝 [${id}] ajout du script "${req.script.name}"`));
      await exec(`npm pkg set "scripts.${req.script.name}=${req.script.command}"`, cwd);
    }
  }

  for (const f of req.files ?? []) {
    const chemin = join(cwd, f.path);
    if (!existsSync(chemin)) {
      console.log(pc.dim(`📝 [${id}] création de ${f.path}`));
      mkdirSync(dirname(chemin), { recursive: true });
      writeFileSync(chemin, f.content);
    }
  }
}
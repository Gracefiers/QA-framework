import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config';
import { registry } from '../checks';
import { ensureReady } from './setup';
import { GITIGNORE_LINES, QA_CONFIG } from './templates';

function ensureGitignore(cwd: string): void {
  const path = join(cwd, '.gitignore');
  const actuel = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const existantes = new Set(actuel.split(/\r?\n/));
  const manquantes = GITIGNORE_LINES.filter((l) => !existantes.has(l));
  if (!manquantes.length) return;
  const prefixe = actuel && !actuel.endsWith('\n') ? '\n' : '';
  writeFileSync(path, actuel + prefixe + manquantes.join('\n') + '\n');
  console.log(pc.dim('📝 [.gitignore] lignes ajoutées'));
}

export async function initProject(cwd: string): Promise<void> {
  if (!existsSync(join(cwd, 'package.json'))) {
    throw new Error(`package.json introuvable dans ${cwd}. Lance d'abord : npm init -y`);
  }

  const configPath = join(cwd, 'qa.config.json');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, QA_CONFIG);
    console.log(pc.dim('📝 création de qa.config.json'));
  }

  ensureGitignore(cwd);

  const config = loadConfig(cwd);
  for (const [id, rule] of Object.entries(config.checks)) {
    if (!rule.enabled) continue;
    const check = registry[id];
    if (!check) {
      console.warn(pc.yellow(`Check inconnu ignoré : "${id}"`));
      continue;
    }
    await ensureReady(cwd, check.id, check.requirement);
  }

  console.log(pc.green('\nProjet prêt. Lance : qa test'));
}

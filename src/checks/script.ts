import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Check } from '../core/types';
import { exec } from '../core/exec';

function listerFichiers(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const trouves: string[] = [];
  for (const entree of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entree.isFile() && /\.(png|zip)$/.test(entree.name)) {
      trouves.push(join(entree.parentPath, entree.name));
    }
  }
  return trouves;
}

export function scriptCheck(id: string, defaultScript: string, artifactsDir?: string): Check {
  return {
    id,
    async run(ctx) {
      const script = ctx.config.checks[id]?.command ?? defaultScript;
      const { code, output } = await exec(`npm run ${script}`, ctx.cwd);
      if (code === 0) {
        return { status: 'pass', summary: `npm run ${script} OK` };
      }
      const artifacts = artifactsDir ? listerFichiers(join(ctx.cwd, artifactsDir)) : undefined;
      return {
        status: 'fail',
        summary: `npm run ${script} a échoué (code ${code})`,
        details: output,
        artifacts: artifacts && artifacts.length ? artifacts : undefined,
      };
    },
  };
}
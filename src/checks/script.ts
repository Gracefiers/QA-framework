import type { Check } from '../core/types';
import { exec } from '../core/exec';

export function scriptCheck(id: string, script: string): Check {
  return {
    id,
    async run(ctx) {
      const { code, output } = await exec(`npm run ${script}`, ctx.cwd);
      return code === 0
        ? { status: 'pass', summary: `npm run ${script} OK` }
        : { status: 'fail', summary: `npm run ${script} a échoué (code ${code})`, details: output };
    },
  };
}
import type { Check, CheckContext, CheckResult } from './types';

export interface RunOptions {
  failFast?: boolean;
  isBlocking?: (id: string) => boolean;
  onStart?: (id: string) => void;
  onDone?: (result: CheckResult) => void;
}

export async function runChecks(
  checks: Check[],
  ctx: CheckContext,
  opts: RunOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  let arrete = false;

  for (const check of checks) {
    if (arrete) {
      const skipped: CheckResult = {
        id: check.id,
        durationMs: 0,
        status: 'skipped',
        summary: 'Ignoré — arrêt anticipé après un échec bloquant (fail-fast)',
      };
      results.push(skipped);
      opts.onDone?.(skipped);
      continue;
    }

    opts.onStart?.(check.id);
    const start = Date.now();
    try {
      const outcome = await check.run(ctx);
      const result: CheckResult = { id: check.id, durationMs: Date.now() - start, ...outcome };
      results.push(result);
      opts.onDone?.(result);
      if (opts.failFast && outcome.status === 'fail' && opts.isBlocking?.(check.id)) {
        arrete = true;
      }
    } catch (e) {
      const result: CheckResult = {
        id: check.id,
        durationMs: Date.now() - start,
        status: 'fail',
        summary: 'Le check a planté',
        details: String(e),
      };
      results.push(result);
      opts.onDone?.(result);
      if (opts.failFast && opts.isBlocking?.(check.id)) {
        arrete = true;
      }
    }
  }

  return results;
}
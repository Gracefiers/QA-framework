import type { Check, CheckContext, CheckResult } from './types';

export async function runChecks(checks: Check[], ctx: CheckContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const start = Date.now();
    try {
      const outcome = await check.run(ctx);
      results.push({ id: check.id, durationMs: Date.now() - start, ...outcome });
    } catch (e) {
      results.push({
        id: check.id,
        durationMs: Date.now() - start,
        status: 'fail',
        summary: 'Le check a planté',
        details: String(e),
      });
    }
  }
  return results;
}
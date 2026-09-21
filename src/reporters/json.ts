import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../core/types';

export interface QaReport {
  version: 1;
  date: string;
  cwd: string;
  verdict: 'PASS' | 'FAIL';
  totalMs: number;
  results: CheckResult[];
}

export function writeJsonReport(
  cwd: string,
  results: CheckResult[],
  verdict: 'PASS' | 'FAIL',
  totalMs: number
): string {
  const dir = join(cwd, '.qa');
  mkdirSync(dir, { recursive: true });

  const report: QaReport = {
    version: 1,
    date: new Date().toISOString(),
    cwd,
    verdict,
    totalMs,
    results,
  };

  const file = join(dir, 'report.json');
  writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}
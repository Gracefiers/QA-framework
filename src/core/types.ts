import type { Config } from '../config.js';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skipped';

export interface CheckOutcome {
  status: CheckStatus;
  summary: string;
  details?: string;
  artifacts?: string[]; // captures, logs, traces (utile dès la phase 4)
}

export interface CheckResult extends CheckOutcome {
  id: string;
  durationMs: number;
}

export interface CheckContext {
  cwd: string;
  config: Config;
}

export interface Check {
  id: string;
  run(ctx: CheckContext): Promise<CheckOutcome>;
}
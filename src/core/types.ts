export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skipped';

export interface CheckOutcome {
  status: CheckStatus;
  summary: string;
  details?: string;
  artifacts?: string[];
}

export interface CheckResult extends CheckOutcome {
  id: string;
  durationMs: number;
}

export interface CheckContext {
  cwd: string;
  config: import('../config').Config;
}

export interface CheckRequirement {
  packages?: string[];
  scripts?: { name: string; command: string }[];
  files?: { path: string; content: string }[];
  postInstall?: string;
}

export interface Check {
  id: string;
  requirement?: CheckRequirement;
  run(ctx: CheckContext): Promise<CheckOutcome>;
}
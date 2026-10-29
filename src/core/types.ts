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

export interface ContextePreparation {
  cwd: string;
  stack: import('./stack').ProfilApp;
}

export interface FichierRequis {
  path: string;
  content: string | ((ctx: ContextePreparation) => string);
  ecrireSi?: (ctx: ContextePreparation) => boolean;
}

type SelonProfil<T> = T | ((ctx: ContextePreparation) => T);

export interface ScriptRequis {
  name: string;
  command: string;
}

export interface CheckRequirement {
  packages?: SelonProfil<string[]>;
  scripts?: SelonProfil<ScriptRequis[]>;
  files?: SelonProfil<FichierRequis[]>;
  postInstall?: string;
  postInstallSi?: (cwd: string) => Promise<boolean>;
}

export interface Check {
  id: string;
  requirement?: CheckRequirement;
  run(ctx: CheckContext): Promise<CheckOutcome>;
}
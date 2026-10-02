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

export interface CheckRequirement {
  packages?: string[]; // paquets npm à installer si absents
  script?: { name: string; command: string }; // script npm à ajouter si absent
  files?: { path: string; content: string }[]; // fichiers de config à créer si absents
  postInstall?: string; // commande lancée une fois, après l'installation des paquets
}

export interface Check {
  id: string;
  requirement?: CheckRequirement;
  run(ctx: CheckContext): Promise<CheckOutcome>;
}

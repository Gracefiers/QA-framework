#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig } from './config';
import { runChecks } from './core/runner';
import { registry } from './checks';
import type { Check } from './core/types';

const icons = { pass: '✔', fail: '✖', warn: '⚠', skipped: '–' } as const;

const program = new Command().name('qa');

program
  .command('test')
  .description('Lance tous les contrôles du projet')
  .option('--cwd <path>', 'dossier du projet à valider', process.cwd())
  .action(async (opts: { cwd: string }) => {
    const config = loadConfig(opts.cwd);

    const checks: Check[] = [];
    for (const [id, rule] of Object.entries(config.checks)) {
      if (!rule.enabled) continue;
      const check = registry[id];
      if (!check) {
        console.error(pc.red(`Check inconnu dans la config : "${id}"`));
        process.exit(2);
      }
      checks.push(check);
    }

    const raw = await runChecks(checks, { cwd: opts.cwd, config });

    const results = raw.map((r) =>
      r.status === 'fail' && config.checks[r.id]?.required === false
        ? { ...r, status: 'warn' as const }
        : r
    );

    for (const r of results) {
      console.log(`${icons[r.status]} ${r.id.padEnd(12)} ${r.summary} (${r.durationMs} ms)`);
      if (r.status === 'fail' && r.details) {
        const lines = r.details.trim().split('\n').slice(0, 15).map((l) => '    ' + l);
        console.log(pc.dim(lines.join('\n')));
      }
    }

    const failed = results.some((r) => r.status === 'fail');
    console.log(failed ? pc.red('\nFAIL') : pc.green('\nPASS'));
    process.exit(failed ? 1 : 0);
  });

program.parse();
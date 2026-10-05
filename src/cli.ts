#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { resolve } from 'node:path';
import { loadConfig } from './config';
import { runChecks } from './core/runner';
import { ensureReady } from './core/setup';
import { registry } from './checks';
import { writeJsonReport } from './reporters/json';
import { writeHtmlReport } from './reporters/html';
import type { Check } from './core/types';
import { fileUrl, openInBrowser } from './core/open';
import { createSpinner } from './core/spinner';
import { initProject } from './core/init';

const icons = { pass: '✔', fail: '✖', warn: '⚠', skipped: '–' } as const;

const program = new Command().name('qa');

program
  .command('test')
  .description('Lance tous les contrôles du projet')
  .option('--cwd <path>', 'dossier du projet à valider', process.cwd())
  .option('--fail-fast', 'arrête dès le premier contrôle bloquant en échec')
  .action(async (opts: { cwd: string; failFast?: boolean }) => {
    opts.cwd = resolve(opts.cwd);
    const startAll = Date.now();
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

    const spinner = createSpinner();

    for (const check of checks) {
      spinner.start(`préparation ${check.id}…`);
      await ensureReady(opts.cwd, check.id, check.requirement);
    }
    spinner.stop();

    const isBlocking = (id: string) => config.checks[id]?.required ?? true;
    const failFast = opts.failFast ?? config.gate.failFast;

    const raw = await runChecks(checks, { cwd: opts.cwd, config }, {
      failFast,
      isBlocking,
      onStart: (id) => spinner.start(`${id}…`),
      onDone: (r) => {
        spinner.stop();
        const status = r.status === 'fail' && !isBlocking(r.id) ? 'warn' as const : r.status;
        console.log(`${icons[status]} ${r.id.padEnd(12)} ${r.summary} (${r.durationMs} ms)`);
        if (status === 'fail' && r.details) {
          const lines = r.details.trim().split('\n').slice(-15).map((l) => '    ' + l);
          console.log(pc.dim(lines.join('\n')));
        }
      },
    });

    const results = raw.map((r) =>
      r.status === 'fail' && !isBlocking(r.id) ? { ...r, status: 'warn' as const } : r
    );

    const failed = results.some((r) => r.status === 'fail');
    const verdict = failed ? 'FAIL' : 'PASS';
    console.log(failed ? pc.red('\nFAIL') : pc.green('\nPASS'));

    const jsonFile = writeJsonReport(opts.cwd, results, verdict, Date.now() - startAll);
    const htmlFile = writeHtmlReport(jsonFile);
    const htmlUrl = fileUrl(htmlFile);
    console.log(pc.dim(`Rapport JSON : ${jsonFile}`));
    console.log(pc.cyan(`Rapport HTML : ${htmlUrl}`));
    await openInBrowser(htmlFile);

    process.exit(failed ? 1 : 0);
  });

program
  .command('init')
  .description('Prépare le projet : config, scripts et fichiers manquants')
  .option('--cwd <path>', 'dossier du projet', process.cwd())
  .action(async (opts: { cwd: string }) => {
    try {
      await initProject(resolve(opts.cwd));
    } catch (e) {
      console.error(pc.red(e instanceof Error ? e.message : String(e)));
      process.exit(2);
    }
  });

program.parse();
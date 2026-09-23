import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { QaReport } from './json';

const ANSI = /\u001b\[[0-9;]*m/g; // codes de couleur parasites du terminal

const labels = {
  pass: 'Réussi',
  fail: 'Échec',
  warn: 'Avertissement',
  skipped: 'Ignoré',
} as const;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function writeHtmlReport(jsonPath: string): string {
  const report: QaReport = JSON.parse(readFileSync(jsonPath, 'utf8'));

  const count = (status: string) => report.results.filter((r) => r.status === status).length;

  const cards = report.results
    .map(
      (r) => `
    <section class="check ${r.status}">
      <div class="head">
        <span class="badge ${r.status}">${labels[r.status]}</span>
        <strong>${esc(r.id)}</strong>
        <span class="time">${r.durationMs} ms</span>
      </div>
            <p>${esc(r.summary)}</p>
      ${r.details ? `<pre>${esc(r.details.replace(ANSI, ''))}</pre>` : ''}
      ${
        r.artifacts?.length
          ? `<ul class="artifacts">${r.artifacts.map((a) => `<li>📎 ${esc(a)}</li>`).join('')}</ul>`
          : ''
      }
    </section>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport QA – ${report.verdict}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; background: #f9fafb; }
  h1 { margin-bottom: .25rem; }
  .meta { color: #6b7280; font-size: .9rem; margin-bottom: 1.5rem; }
  .verdict { display: inline-block; padding: .4rem 1.2rem; border-radius: 999px; font-weight: 700; color: #fff; font-size: 1.2rem; }
  .verdict.PASS { background: #16a34a; }
  .verdict.FAIL { background: #dc2626; }
  .summary { margin: 1rem 0 2rem; color: #374151; }
  .check { background: #fff; border-left: 6px solid #9ca3af; border-radius: 8px; padding: .8rem 1rem; margin-bottom: .8rem; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .check.pass { border-color: #16a34a; }
  .check.fail { border-color: #dc2626; }
  .check.warn { border-color: #f59e0b; }
  .head { display: flex; gap: .75rem; align-items: center; }
  .time { margin-left: auto; color: #6b7280; font-size: .85rem; }
  .badge { font-size: .75rem; padding: .15rem .6rem; border-radius: 999px; color: #fff; background: #9ca3af; }
  .badge.pass { background: #16a34a; }
  .badge.fail { background: #dc2626; }
  .badge.warn { background: #f59e0b; }
  pre { background: #111827; color: #e5e7eb; padding: .8rem; border-radius: 6px; overflow-x: auto; font-size: .8rem; white-space: pre-wrap; }
</style>
</head>
<body>
  <h1>Rapport de validation QA</h1>
  <div class="meta">${esc(new Date(report.date).toLocaleString('fr-FR'))} · ${esc(report.cwd)}</div>
  <div class="verdict ${report.verdict}">${report.verdict}</div>
  <p class="summary">
    ${count('pass')} réussi(s) · ${count('fail')} en échec · ${count('warn')} avertissement(s)
    · durée totale ${(report.totalMs / 1000).toFixed(1)} s
  </p>
  ${cards}
</body>
</html>`;

  const file = join(dirname(jsonPath), 'report.html');
  writeFileSync(file, html);
  return file;
}
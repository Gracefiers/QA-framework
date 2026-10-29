import type { Check, CheckOutcome } from '../core/types';
import { exec } from '../core/exec';

interface Correctif {
  name?: string;
  version?: string;
  isSemVerMajor?: boolean;
}

interface Vulnerabilite {
  name?: string;
  severity?: string;
  fixAvailable?: boolean | Correctif;
}

const NIVEAUX = new Set(['high', 'critical']);

export function extraireJson(sortie: string): unknown | null {
  const debut = sortie.indexOf('{');
  if (debut < 0) return null;

  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  for (let i = debut; i < sortie.length; i++) {
    const c = sortie[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === '\\') echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === '{') profondeur++;
    else if (c === '}') {
      profondeur--;
      if (profondeur === 0) {
        try {
          return JSON.parse(sortie.slice(debut, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function correctifCompatible(fix: Vulnerabilite['fixAvailable']): boolean {
  if (fix === true) return true;
  if (fix && typeof fix === 'object') return fix.isSemVerMajor !== true;
  return false;
}

function decrire(nom: string, vuln: Vulnerabilite): string {
  const fix = vuln.fixAvailable;
  if (fix && typeof fix === 'object') {
    const cible = [fix.name, fix.version].filter(Boolean).join('@');
    const precision = cible ? ` (${cible})` : '';
    if (fix.isSemVerMajor) return `${nom} : correctif en version majeure${precision}`;
    return `${nom} : correctif compatible${precision}`;
  }
  if (fix === true) return `${nom} : correctif compatible`;
  return `${nom} : aucun correctif`;
}

export function classerAudit(rapport: unknown): CheckOutcome {
  if (!rapport || typeof rapport !== 'object') {
    return { status: 'fail', summary: 'npm audit illisible' };
  }

  const corps = rapport as {
    error?: { summary?: string };
    message?: string;
    vulnerabilities?: Record<string, Vulnerabilite>;
  };

  if (!corps.vulnerabilities) {
    const message = corps.error?.summary ?? corps.message ?? "npm audit n'a pas renvoyé de rapport";
    return { status: 'fail', summary: message };
  }

  const hautes = Object.entries(corps.vulnerabilities).filter(([, vuln]) => NIVEAUX.has(vuln.severity ?? ''));
  const bloquantes = hautes.filter(([, vuln]) => correctifCompatible(vuln.fixAvailable));
  const avertissements = hautes.filter(([, vuln]) => !correctifCompatible(vuln.fixAvailable));
  const details = [...bloquantes, ...avertissements].map(([nom, vuln]) => decrire(vuln.name ?? nom, vuln)).join('\n');

  if (bloquantes.length) {
    const noms = bloquantes.map(([nom, vuln]) => vuln.name ?? nom).join(', ');
    const suite = avertissements.length ? ` — ${avertissements.length} sans correctif compatible` : '';
    return { status: 'fail', summary: `Alertes corrigeables : ${noms}${suite}`, details };
  }

  if (avertissements.length) {
    const noms = avertissements.map(([nom, vuln]) => vuln.name ?? nom).join(', ');
    return { status: 'warn', summary: `Alertes sans correctif compatible : ${noms}`, details };
  }

  return { status: 'pass', summary: 'Aucune alerte haute ou critique' };
}

export const auditCheck: Check = {
  id: 'audit',
  async run(ctx) {
    const { output } = await exec('npm audit --json', ctx.cwd);
    const rapport = extraireJson(output);
    if (!rapport) return { status: 'fail', summary: 'npm audit illisible', details: output };
    return classerAudit(rapport);
  },
};

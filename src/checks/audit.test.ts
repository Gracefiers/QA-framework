import { describe, expect, it } from 'vitest';
import { classerAudit, extraireJson } from './audit';

describe('classerAudit', () => {
  it('passe quand il n y a aucune alerte haute', () => {
    expect(classerAudit({ vulnerabilities: { lodash: { name: 'lodash', severity: 'moderate', fixAvailable: true } } }).status).toBe('pass');
  });

  it('échoue seulement si un correctif compatible existe', () => {
    const resultat = classerAudit({
      vulnerabilities: {
        lodash: { name: 'lodash', severity: 'high', fixAvailable: { name: 'lodash', version: '4.17.21', isSemVerMajor: false } },
        zod: { name: 'zod', severity: 'high', fixAvailable: false },
        postcss: { name: 'postcss', severity: 'critical', fixAvailable: { name: 'next', version: '16.4.3', isSemVerMajor: true } },
      },
    });

    expect(resultat.status).toBe('fail');
    expect(resultat.summary).toContain('lodash');
    expect(resultat.summary).toContain('sans correctif compatible');
    expect(resultat.details).toContain('zod : aucun correctif');
    expect(resultat.details).toContain('version majeure');
  });

  it('avertit quand le seul correctif est une version majeure ou absent', () => {
    const resultat = classerAudit({
      vulnerabilities: {
        zod: { name: 'zod', severity: 'high', fixAvailable: false },
        postcss: { name: 'postcss', severity: 'high', fixAvailable: { name: 'next', version: '16.4.3', isSemVerMajor: true } },
      },
    });

    expect(resultat.status).toBe('warn');
    expect(resultat.summary).toContain('zod');
    expect(resultat.summary).toContain('postcss');
  });

  it('échoue si npm audit ne renvoie pas de rapport', () => {
    expect(classerAudit({ error: { summary: 'registry injoignable' } }).status).toBe('fail');
  });
});

describe('extraireJson', () => {
  it('ignore les avertissements npm avant le JSON', () => {
    const rapport = extraireJson('npm warn devdir\n{"vulnerabilities":{}}\n');
    expect(rapport).toEqual({ vulnerabilities: {} });
  });
});

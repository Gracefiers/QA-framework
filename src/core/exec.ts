import { spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  output: string;
}

export function exec(command: string, cwd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const existing = process.env.NODE_OPTIONS?.trim() ?? '';
    const nodeOptions = existing.includes('--use-system-ca')
      ? existing
      : [existing, '--use-system-ca'].filter(Boolean).join(' ');

    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, NODE_OPTIONS: nodeOptions },
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (e) => resolve({ code: 1, output: String(e) }));
  });
}
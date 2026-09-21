import { spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  output: string;
}

export function exec(command: string, cwd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (e) => resolve({ code: 1, output: String(e) }));
  });
}
import { afterEach, describe, expect, it } from 'vitest';
import { createSpinner } from './spinner';

describe('createSpinner', () => {
  const stdout = process.stdout;
  const write = stdout.write.bind(stdout);
  const isTTY = Object.getOwnPropertyDescriptor(stdout, 'isTTY');

  afterEach(() => {
    stdout.write = write;
    if (isTTY) Object.defineProperty(stdout, 'isTTY', isTTY);
  });

  it('affiche une frame qui tourne quand le terminal le permet', () => {
    const ecrits: string[] = [];
    Object.defineProperty(stdout, 'isTTY', { configurable: true, value: true });
    stdout.write = ((chunk: string | Uint8Array) => {
      ecrits.push(String(chunk));
      return true;
    }) as typeof stdout.write;

    const spinner = createSpinner();
    spinner.start('installation');
    spinner.stop();

    const texte = ecrits.join('');
    expect(texte).toContain('installation');
    expect(texte).toMatch(/⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/);
  });
});

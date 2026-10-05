import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function fileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

export function openInBrowser(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    const child =
      process.platform === 'win32'
        ? spawn('cmd', ['/c', 'start', '', filePath], { detached: true, stdio: 'ignore', windowsHide: true })
        : process.platform === 'darwin'
          ? spawn('open', [filePath], { detached: true, stdio: 'ignore' })
          : spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' });

    child.on('error', (err) => {
      console.error("Impossible d'ouvrir le rapport automatiquement :", err.message);
      resolve();
    });
    child.unref();
    resolve();
  });
}

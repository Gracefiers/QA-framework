import pc from 'picocolors';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function createSpinner() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let frame = 0;
  let label = '';
  const tty = Boolean(process.stdout.isTTY);

  function draw() {
    process.stdout.write(`\r${pc.cyan(FRAMES[frame % FRAMES.length])} ${label}   `);
    frame += 1;
  }

  return {
    start(text: string) {
      this.stop();
      label = text;
      if (!tty) {
        console.log(`… ${text}`);
        return;
      }
      frame = 0;
      process.stdout.write('\x1b[?25l');
      draw();
      timer = setInterval(draw, 80);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (tty) {
        process.stdout.write('\r\x1b[K\x1b[?25h');
      }
    },
  };
}

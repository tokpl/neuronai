const RESET = '\u001b[0m';
const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const GREEN = '\u001b[32m';
const YELLOW = '\u001b[33m';
const RED = '\u001b[31m';
const CYAN = '\u001b[36m';

const useColor = !process.env['NO_COLOR'] && process.stdout.isTTY !== false;

function paint(code: string, text: string): string {
  return useColor ? `${code}${text}${RESET}` : text;
}

export const ui = {
  title(text: string): void {
    console.log(paint(BOLD + CYAN, text));
  },
  success(text: string): void {
    console.log(paint(GREEN, `✓ ${text}`));
  },
  warn(text: string): void {
    console.log(paint(YELLOW, `! ${text}`));
  },
  error(text: string): void {
    console.error(paint(RED, `✗ ${text}`));
  },
  /** Multi-line actionable failure (preferred over a single opaque message). */
  failHelp(title: string, causes: string[], fixCommands: string[] = []): void {
    console.error(paint(RED, `✗ ${title}`));
    if (causes.length) {
      console.error(paint(DIM, 'Possible causes:'));
      causes.forEach((c, i) => console.error(paint(DIM, `  ${i + 1}. ${c}`)));
    }
    for (const cmd of fixCommands) {
      console.error(paint(YELLOW, `→ ${cmd}`));
    }
  },
  info(text: string): void {
    console.log(paint(DIM, text));
  },
  step(n: number, total: number, text: string): void {
    console.log(paint(CYAN, `[${n}/${total}]`) + ` ${text}`);
  },
  blank(): void {
    console.log('');
  },
  kv(key: string, value: string): void {
    console.log(`  ${paint(DIM, key.padEnd(14))} ${value}`);
  },
  suggest(text: string): void {
    console.log(paint(YELLOW, `→ ${text}`));
  },
  welcome(lines: string[]): void {
    console.log(paint(BOLD + GREEN, lines[0] ?? ''));
    for (const line of lines.slice(1)) {
      console.log(paint(DIM, line));
    }
  },
};

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'unknown';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

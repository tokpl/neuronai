import { ui } from '../ui/output.js';

/** Sequential step tracker for first-run / long CLI flows. */
export class ProgressUI {
  private current = 0;

  constructor(
    private readonly total: number,
    private readonly title?: string,
  ) {
    if (title) {
      ui.title(title);
      ui.blank();
    }
  }

  start(label: string): void {
    this.current += 1;
    ui.step(this.current, this.total, label);
  }

  ok(label: string): void {
    ui.success(label);
  }

  warn(label: string): void {
    ui.warn(label);
  }

  fail(label: string): void {
    ui.error(label);
  }

  done(): void {
    ui.blank();
  }
}

export function printCheckList(items: Array<{ ok: boolean; label: string }>): void {
  for (const item of items) {
    if (item.ok) ui.success(item.label);
    else ui.warn(item.label);
  }
}

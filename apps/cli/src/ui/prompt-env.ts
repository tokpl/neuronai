import { stdin as input, stdout as output } from 'node:process';

export function canPromptInteractively(): boolean {
  return Boolean(input.isTTY && output.isTTY) && process.env['CI'] !== 'true';
}

/**
 * Minimal local logger. Writes to stderr so stdout stays clean for MCP JSON-RPC.
 * No transport, no sinks, no telemetry — this is a CLI tool.
 */
export interface Logger {
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
}

type Destination = 'stderr' | 'silent';

export function createLogger(destination: Destination = 'stderr'): Logger {
  const write = (level: string, message: string, fields?: Record<string, unknown>): void => {
    if (destination === 'silent') return;
    const suffix = fields && Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : '';
    process.stderr.write(`[neuron:${level}] ${message}${suffix}\n`);
  };

  return {
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}

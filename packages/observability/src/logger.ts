import pino, { type Logger, type LoggerOptions } from 'pino';

import { getCorrelationId } from './correlation.js';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type LoggerDestination = 'stdout' | 'stderr';

export interface CreateLoggerOptions {
  name: string;
  level?: LogLevel;
  /**
   * MCP stdio hosts treat stdout as JSON-RPC only.
   * Use `stderr` for any process sharing that pipe (default: stdout).
   */
  destination?: LoggerDestination;
}

export type NeuronLogger = Logger;

export function createLogger(options: CreateLoggerOptions): NeuronLogger {
  const isProd = process.env['NODE_ENV'] === 'production';
  const level =
    options.level ??
    (process.env['LOG_LEVEL'] as LogLevel | undefined) ??
    (isProd ? 'info' : 'debug');

  const destination: LoggerDestination =
    options.destination ??
    (process.env['NEURON_MCP_STDIO'] === '1' ? 'stderr' : 'stdout');

  const loggerOptions: LoggerOptions = {
    name: options.name,
    level,
    base: {
      service: options.name,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
      const correlationId = getCorrelationId();
      return correlationId ? { correlationId } : {};
    },
  };

  if (destination === 'stderr') {
    return pino(loggerOptions, pino.destination({ dest: 2, sync: true }));
  }

  return pino(loggerOptions);
}

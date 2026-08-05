import pino, { type Logger, type LoggerOptions } from 'pino';

import { getCorrelationId } from './correlation.js';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface CreateLoggerOptions {
  name: string;
  level?: LogLevel;
}

export type NeuronLogger = Logger;

export function createLogger(options: CreateLoggerOptions): NeuronLogger {
  const isProd = process.env['NODE_ENV'] === 'production';
  const level =
    options.level ??
    (process.env['LOG_LEVEL'] as LogLevel | undefined) ??
    (isProd ? 'info' : 'debug');

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

  return pino(loggerOptions);
}

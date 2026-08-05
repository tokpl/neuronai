export {
  createLogger,
  type CreateLoggerOptions,
  type LoggerDestination,
  type LogLevel,
  type NeuronLogger,
} from './logger.js';
export {
  getCorrelationId,
  withCorrelationId,
  withCorrelationIdAsync,
} from './correlation.js';
export { MetricsRegistry, globalMetrics, type MetricName } from './metrics.js';
export { NoopTracer, setTracer, getTracer, type Tracer, type Span } from './tracing.js';
export {
  NoopErrorReporter,
  ConsoleErrorReporter,
  setErrorReporter,
  getErrorReporter,
  reportError,
  type ErrorReporter,
  type ErrorReport,
} from './error-reporting.js';

export * from './tracing/index.js';
export * from './debug/index.js';
export * from './events/index.js';
export * from './reports/index.js';
export {
  NeuronMetrics,
  createNeuronMetrics,
} from './metrics/neuron-metrics.js';
export {
  ObservabilityEngine,
  createObservabilityEngine,
  type RecordOperationInput,
  type ExplainLastResult,
} from './facade/observability-engine.js';

/** MCP / public API surface version for clients */
export const NEURON_API_VERSION = 'neuron/v1';
export const PACKAGE_VERSION = '0.1.0';

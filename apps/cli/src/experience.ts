/**
 * CLI experience modules (progress, config validation, diagnostics).
 * The published bin lives in apps/cli (`neuron`).
 */
export { ProgressUI, printCheckList } from './progress/progress-ui.js';
export { ConfigValidator, createConfigValidator } from './config/config-validator.js';
export type { ConfigIssue, ConfigValidationResult } from './config/config-validator.js';
export {
  neuronLocalConfigSchema,
  validateLocalConfig,
  DEFAULT_IGNORE,
} from './config/local-config.js';
export type { NeuronLocalConfig, NeuronMetadata } from './config/local-config.js';
export { NeuronCliError, printNeuronError, isNeuronCliError } from './diagnostics/errors.js';
export { NeuronUpdater, runUpdate as runSchemaUpdate } from './diagnostics/updater.js';
export { runDoctorChecks } from './diagnostics/doctor-checks.js';
export type { DoctorCheck } from './diagnostics/doctor-checks.js';
export {
  FIRST_RUN_WELCOME,
  PRIVACY_BANNER,
  formatNeuronReport,
} from './templates/first-run.js';
export type { NeuronInitReport } from './templates/first-run.js';

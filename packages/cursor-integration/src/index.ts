export {
  buildNeuronMcpEntry,
  mergeNeuronMcpConfig,
  resolveNeuronCliInvocation,
  validateCursorMcpConfig,
  type McpValidationResult,
  type NeuronMcpEntry,
} from './mcp-config.js';
export { installCursorIntegration, type CursorInstallResult } from './install.js';
export { writeProjectBrainFiles, type ProjectBrainInput } from './project-brain.js';
export {
  runCursorDoctorChecks,
  type CursorDoctorCheck,
  type CursorDoctorReport,
} from './doctor.js';

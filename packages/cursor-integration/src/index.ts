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
  formatNeuronMcpStatus,
  probeConfiguredMcp,
  EXPECTED_MCP_TOOLS,
  LEGACY_TOOL_MARKERS,
  type CursorDoctorCheck,
  type CursorDoctorReport,
  type NeuronMcpStatus,
  type IdeCatalogState,
  type McpProbeResult,
} from './doctor.js';

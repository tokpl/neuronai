import type { Incident, IncidentMemory } from '../types.js';

/**
 * Convert a resolved incident into durable project lesson memory.
 */
export class IncidentMemoryFactory {
  fromResolved(incident: Incident): IncidentMemory {
    if (incident.status !== 'RESOLVED' && incident.status !== 'ARCHIVED') {
      throw new Error('Only resolved/archived incidents become incident memories');
    }
    if (!incident.rootCause || !incident.solution) {
      throw new Error('Resolved incident needs rootCause and solution');
    }
    const lesson =
      incident.lesson ??
      incident.preventiveActions[0] ??
      'Document the configuration/ownership that prevented recurrence.';

    return {
      incidentId: incident.id,
      title: `Incident lesson: ${incident.title}`,
      problem: incident.description || incident.title,
      rootCause: incident.rootCause,
      solution: incident.solution,
      lesson,
    };
  }

  markdown(memory: IncidentMemory): string {
    return [
      `# ${memory.title}`,
      '',
      '## Problem',
      '',
      memory.problem,
      '',
      '## Root cause',
      '',
      memory.rootCause,
      '',
      '## Solution',
      '',
      memory.solution,
      '',
      '## Lesson',
      '',
      memory.lesson,
      '',
      `_Incident: ${memory.incidentId}_`,
    ].join('\n');
  }
}

export function createIncidentMemoryFactory(): IncidentMemoryFactory {
  return new IncidentMemoryFactory();
}

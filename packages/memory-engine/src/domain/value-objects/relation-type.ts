import { ValidationError } from '@neuronai/types';
import type { RelationType as RelationTypeValue } from '@neuronai/types';

const VALUES = [
  'depends_on',
  'related_to',
  'replaces',
  'conflicts_with',
  'derived_from',
] as const satisfies readonly RelationTypeValue[];

export class RelationType {
  private constructor(readonly value: RelationTypeValue) {}

  static readonly values = VALUES;

  static create(raw: string): RelationType {
    if (!(VALUES as readonly string[]).includes(raw)) {
      throw new ValidationError(`Invalid relation type: ${raw}`, {
        allowed: [...VALUES],
      });
    }
    return new RelationType(raw as RelationTypeValue);
  }
}

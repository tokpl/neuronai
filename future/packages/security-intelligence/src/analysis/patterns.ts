import type { SecurityPatternModel } from '../types.js';

/**
 * Heuristic security pattern map for a project (advisor — not a CVE scanner).
 */
export class SecurityPatternAnalyzer {
  analyze(input: {
    filePaths?: string[];
    snippets?: string[];
    architectureNotes?: string[];
  }): SecurityPatternModel {
    const blob = [
      ...(input.filePaths ?? []),
      ...(input.snippets ?? []),
      ...(input.architectureNotes ?? []),
    ]
      .join('\n')
      .toLowerCase();

    const authMiddleware = collect(blob, [
      [/authmiddleware|requireauth|ensureauth|passport|jwt\.verify|clerk|nextauth/, 'Auth middleware'],
      [/middleware.*auth|auth.*middleware/, 'Auth middleware path'],
    ]);

    const permissionChecks = collect(blob, [
      [/haspermission|checkpermission|can\(|authorize|rbac|roleguard|casl/, 'Permission / RBAC checks'],
      [/requireadmin|isadmin|roles?\s*includes/, 'Role checks'],
    ]);

    const inputValidation = collect(blob, [
      [/zod|joi|yup|class-validator|ajv|sanitize|escapehtml/, 'Input validation library'],
      [/validate(request|body|input)/, 'Request validation'],
    ]);

    const encryptionUsage = collect(blob, [
      [/bcrypt|argon2|scrypt|pbkdf2/, 'Password hashing'],
      [/aes|crypto\.createcipher|jose|jsonwebtoken|subtle\.crypto/, 'Crypto primitives'],
      [/tls|https|hsts/, 'Transport security'],
    ]);

    const dataAccessPatterns = collect(blob, [
      [/prisma|typeorm|sequelize|drizzle|knex|mongodb/, 'ORM / DB access'],
      [/rowlevel|tenantid|organizationid|soft.?delete/, 'Multi-tenant / isolation hints'],
      [/select\s+\*|raw\s*\(|\$queryraw/, 'Raw query risk surface'],
    ]);

    const parts = [
      authMiddleware.length ? 'auth middleware present' : 'auth middleware unclear',
      permissionChecks.length ? 'permission checks found' : 'permission checks sparse',
      inputValidation.length ? 'validation libraries in use' : 'validation patterns weak/unknown',
      encryptionUsage.length ? 'crypto usage detected' : 'crypto usage not evident',
    ];

    return {
      authMiddleware,
      permissionChecks,
      inputValidation,
      encryptionUsage,
      dataAccessPatterns,
      summary: `Security model: ${parts.join('; ')}.`,
    };
  }
}

function collect(blob: string, rules: Array<[RegExp, string]>): string[] {
  const out: string[] = [];
  for (const [re, label] of rules) {
    if (re.test(blob)) out.push(label);
  }
  return [...new Set(out)];
}

export function createSecurityPatternAnalyzer(): SecurityPatternAnalyzer {
  return new SecurityPatternAnalyzer();
}

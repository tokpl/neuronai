import type { DependencySecurityNote } from '../types.js';

/**
 * Dependency security memory — usage context, not a CVE database.
 */
export class DependencySecurityAnalyzer {
  analyze(deps: Array<{ name: string; version?: string; importers?: string[] }>): DependencySecurityNote[] {
    return deps.map((d) => {
      const name = d.name.toLowerCase();
      const ctx = `${d.name} ${(d.importers ?? []).join(' ')}`.toLowerCase();
      const handlesAuth =
        /passport|jsonwebtoken|jose|clerk|next-auth|auth0|oauth|bcrypt|argon2|lucia|better-auth/.test(
          name,
        ) || /auth|login|session/.test(ctx);
      const handlesSecrets =
        /dotenv|vault|aws-sdk|@aws-sdk|secret|credential/.test(name) || /secret|env/.test(ctx);
      const handlesPayments =
        /stripe|paypal|braintree|adyen/.test(name) || /payment|billing|checkout/.test(ctx);

      const notes: string[] = [];
      if (handlesAuth) notes.push('This package participates in authentication / identity flow.');
      if (handlesSecrets) notes.push('This package may touch secrets or credential loading.');
      if (handlesPayments) notes.push('This package sits on a payment / money path — treat as high trust.');
      if (!notes.length) {
        notes.push('General dependency — review if it reaches user data or network boundaries.');
      }

      let usageContext = 'general library';
      if (handlesAuth) usageContext = 'authentication flow';
      else if (handlesPayments) usageContext = 'payment processing';
      else if (handlesSecrets) usageContext = 'configuration / secrets loading';

      return {
        packageName: d.name,
        version: d.version,
        usageContext,
        handlesAuth,
        handlesSecrets,
        handlesPayments,
        notes,
      };
    });
  }
}

export function createDependencySecurityAnalyzer(): DependencySecurityAnalyzer {
  return new DependencySecurityAnalyzer();
}

import { tokenize } from './tokenize.js';

/**
 * A small, fixed vocabulary of engineering concepts.
 *
 * The point is convergence: "billing", "payments" and "stripe" should reach the
 * same knowledge without embeddings or a model. This is a lookup table, not
 * inference — if a word is not here, nothing is invented.
 */
const CONCEPT_TERMS: Record<string, string[]> = {
  auth: [
    'auth',
    'authentication',
    'authenticate',
    'authorization',
    'authorize',
    'login',
    'logout',
    'signin',
    'signup',
    'jwt',
    'oauth',
    'session',
    'token',
    'credential',
    'password',
    'permission',
    'rbac',
    'acl',
    'identity',
  ],
  billing: [
    'billing',
    'bill',
    'payment',
    'pay',
    'invoice',
    'stripe',
    'paypal',
    'checkout',
    'subscription',
    'plan',
    'pricing',
    'charge',
    'refund',
    'webhook',
  ],
  database: [
    'database',
    'db',
    'sql',
    'postgres',
    'postgresql',
    'mysql',
    'mongo',
    'mongodb',
    'sqlite',
    'redis',
    'prisma',
    'drizzle',
    'typeorm',
    'sequelize',
    'mongoose',
    'orm',
    'migration',
    'schema',
    'query',
    'repository',
    'persistence',
    'datastore',
  ],
  api: [
    'api',
    'route',
    'router',
    'routing',
    'endpoint',
    'controller',
    'handler',
    'rest',
    'graphql',
    'request',
    'response',
    'http',
    'middleware',
  ],
  testing: ['test', 'testing', 'spec', 'vitest', 'jest', 'mocha', 'cypress', 'playwright', 'e2e'],
  configuration: [
    'config',
    'configuration',
    'configure',
    'setting',
    'env',
    'environment',
    'dotenv',
    'setup',
    'option',
  ],
  ui: ['ui', 'component', 'view', 'page', 'render', 'frontend', 'css', 'style', 'layout'],
  logging: ['log', 'logging', 'logger', 'trace', 'monitor', 'metric', 'observability'],
  security: ['security', 'secure', 'encrypt', 'hash', 'secret', 'vulnerability', 'sanitize', 'csrf', 'xss'],
  deployment: ['deploy', 'deployment', 'docker', 'kubernetes', 'helm', 'ci-cd', 'release'],
  validation: ['validation', 'validate', 'zod', 'joi', 'yup', 'schema'],
  caching: ['cache', 'caching', 'memo', 'redis', 'ttl'],
  messaging: ['queue', 'kafka', 'rabbitmq', 'event', 'pubsub', 'broker', 'message'],
  users: ['user', 'account', 'profile', 'member', 'customer'],
};

/** term (already stemmed) -> concepts it belongs to */
const TERM_INDEX = new Map<string, string[]>();
for (const [concept, terms] of Object.entries(CONCEPT_TERMS)) {
  for (const raw of terms) {
    for (const term of tokenize(raw)) {
      const existing = TERM_INDEX.get(term);
      if (existing) {
        if (!existing.includes(concept)) existing.push(concept);
      } else {
        TERM_INDEX.set(term, [concept]);
      }
    }
  }
}

export const KNOWN_CONCEPTS = Object.keys(CONCEPT_TERMS);

/** Every lexicon term belonging to a concept (raw, unstemmed). */
export function termsForConcept(concept: string): string[] {
  return CONCEPT_TERMS[concept] ?? [concept];
}

/** Concepts mentioned anywhere in the given text. Order is stable. */
export function conceptsFor(text: string): string[] {
  const found: string[] = [];
  for (const term of tokenize(text)) {
    for (const concept of TERM_INDEX.get(term) ?? []) {
      if (!found.includes(concept)) found.push(concept);
    }
  }
  return found;
}

/** Concepts a single already-stemmed term belongs to. */
export function conceptsForTerm(term: string): string[] {
  return TERM_INDEX.get(term) ?? [];
}

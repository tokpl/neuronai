import { IntegrationError } from '@neuronai/types';

export interface AuthContext {
  authenticated: boolean;
  mode: 'local' | 'cloud';
  subject?: string;
}

export interface AuthProvider {
  readonly mode: 'local' | 'cloud';
  assertAuthorized(apiKey?: string): AuthContext;
}

export class LocalAuthProvider implements AuthProvider {
  readonly mode = 'local' as const;

  assertAuthorized(): AuthContext {
    return { authenticated: true, mode: 'local', subject: 'local-user' };
  }
}

export class ApiKeyAuthProvider implements AuthProvider {
  readonly mode = 'cloud' as const;

  constructor(private readonly expectedKey: string) {}

  assertAuthorized(apiKey?: string): AuthContext {
    if (!apiKey || apiKey !== this.expectedKey) {
      throw new IntegrationError('Invalid or missing API key', { code: 'AUTH_ERROR' });
    }
    return { authenticated: true, mode: 'cloud', subject: 'api-key' };
  }
}

export function createAuthProvider(mode: 'local' | 'cloud'): AuthProvider {
  if (mode === 'cloud') {
    const key = process.env['NEURON_API_KEY'] ?? '';
    return new ApiKeyAuthProvider(key);
  }
  return new LocalAuthProvider();
}

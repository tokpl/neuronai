/**
 * Error reporting abstraction (Sentry / OTel / self-hosted).
 * Never send without explicit consent - callers must gate with PrivacyConsent.
 */
export interface ErrorReport {
  message: string;
  name?: string;
  stack?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
}

export interface ErrorReporter {
  capture(error: ErrorReport): Promise<void> | void;
}

export class NoopErrorReporter implements ErrorReporter {
  capture(): void {}
}

export class ConsoleErrorReporter implements ErrorReporter {
  capture(error: ErrorReport): void {
    // Structured stderr only - no network
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'neuron.error',
        ...error,
      }),
    );
  }
}

let activeReporter: ErrorReporter = new NoopErrorReporter();

export function setErrorReporter(reporter: ErrorReporter): void {
  activeReporter = reporter;
}

export function getErrorReporter(): ErrorReporter {
  return activeReporter;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  void activeReporter.capture({
    message: err.message,
    name: err.name,
    stack: err.stack,
    context,
  });
}

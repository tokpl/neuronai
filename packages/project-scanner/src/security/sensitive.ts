const SENSITIVE_NAMES = [
  /^\.env(\.|$)/i,
  /credentials/i,
  /secrets?/i,
  /private[._-]?key/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /id_rsa/i,
  /\.keystore$/i,
  /service-account.*\.json$/i,
];

/**
 * Never analyze secrets / credentials / private keys.
 */
export class SensitiveFileDetector {
  isSensitive(relativePath: string): boolean {
    const base = relativePath.replace(/\\/g, '/').split('/').pop() ?? relativePath;
    return SENSITIVE_NAMES.some((re) => re.test(base) || re.test(relativePath));
  }
}

export function createSensitiveFileDetector(): SensitiveFileDetector {
  return new SensitiveFileDetector();
}

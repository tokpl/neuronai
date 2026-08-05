const SENSITIVE = [
  /^\.env(\.|$)/i,
  /credentials/i,
  /secrets?/i,
  /private[._-]?key/i,
  /\.pem$/i,
  /id_rsa/i,
  /\.keystore$/i,
];

/**
 * Never monitor or analyze secrets / credentials.
 */
export class SensitiveChangeFilter {
  isSensitive(path: string): boolean {
    const norm = path.replace(/\\/g, '/');
    const base = norm.split('/').pop() ?? norm;
    return SENSITIVE.some((re) => re.test(base) || re.test(norm));
  }

  allow(path: string): boolean {
    return !this.isSensitive(path);
  }
}

export function createSensitiveChangeFilter(): SensitiveChangeFilter {
  return new SensitiveChangeFilter();
}

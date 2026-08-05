import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDbClient } from '../src/client/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const client = createDbClient();
  const sqlPath = resolve(__dirname, '../migrations/0001_memory_core.sql');
  const sqlText = await readFile(sqlPath, 'utf8');
  await client.sql.unsafe(sqlText);
  await client.close();
  console.log('Applied migrations/0001_memory_core.sql');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

// Explicit operator command. Never invoked by a build or request handler.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) throw new Error('Set DATABASE_URL_UNPOOLED for the intended database branch.');
if (new URL(connectionString).hostname.includes('-pooler')) throw new Error('Migrations require the direct database connection.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query(await readFile(new URL('./001-community.sql', import.meta.url), 'utf8'));
  console.log('Community schema migration applied.');
} finally { await client.end(); }

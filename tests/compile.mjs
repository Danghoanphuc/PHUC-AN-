import { PGlite } from '@electric-sql/pglite';
import { baselineSql } from './baseline.mjs';
import { applyTestMigrations } from './migrations.mjs';
import { readFileSync } from 'node:fs';
const db = await PGlite.create();
try {
  await db.exec(baselineSql());
  await applyTestMigrations(db);
  console.log('Migration compiled on reconstructed Postgres schema');
} catch(e) {
  console.error({message:e.message, detail:e.detail, position:e.position, where:e.where});
  process.exitCode=1;
} finally { await db.close(); }

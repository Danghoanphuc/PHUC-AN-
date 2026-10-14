import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {baselineSql} from './baseline.mjs';
import {applyTestMigrations} from './migrations.mjs';
const db=await PGlite.create();
try {
 await db.exec(baselineSql());
 await applyTestMigrations(db);
 const results=await db.exec(readFileSync(new URL('./live-smoke.sql',import.meta.url),'utf8'));
 console.log(results.at(-1).rows);
}catch(e){console.error({message:e.message,where:e.where,detail:e.detail});process.exitCode=1;}
finally{await db.close();}

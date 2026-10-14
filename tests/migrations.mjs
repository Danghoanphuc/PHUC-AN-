import {readFileSync,readdirSync} from 'node:fs';
export async function applyTestMigrations(db){
 const root=new URL('../supabase/migrations/',import.meta.url);
 for(const file of readdirSync(root).filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(file,root),'utf8'));
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Scoped application-data backup. Auth credentials and Storage objects are excluded.
const project = 'goegjuglstapjwcckawp';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(), project, 'Unexpected linked project');
mkdirSync('ops.local/backups',{recursive:true});
const hash = (value) => createHash('sha256').update(value).digest('hex');
function query(sql) {
  const file = resolve('ops.local/backups/backup-operation.sql');
  writeFileSync(file,sql);
  let output;
  try { output=execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']}); }
  catch { throw Error('Backup operation failed. The rehearsal transaction does not modify production documents.'); }
  let result;
  try { result=JSON.parse(output.replace(/^\uFEFF/,'')); } catch { throw Error('Backup query did not return valid JSON'); }
  assert.ok(Array.isArray(result.rows),'Missing backup rows');
  return result.rows;
}
const input = process.argv[2];
if (input === '--rehearse') {
  const path=resolve(process.argv[3]);
  const bytes=readFileSync(path);
  assert.equal(hash(bytes),readFileSync(path+'.sha256','utf8').trim(),'Backup checksum mismatch');
  const snapshot=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  assert.equal(snapshot.project,project);
  assert.equal(snapshot.version,1);
  assert.ok(Array.isArray(snapshot.scenes));
  const tag=`$backup_${randomUUID().replaceAll('-','')}$`, payload=JSON.stringify(snapshot.scenes);
  assert.ok(!payload.includes(tag));
  const rows=query(`begin;
    create temporary table fontex_restore_rehearsal (like public.visual_scenes including all);
    insert into fontex_restore_rehearsal(user_id,id,scene,updated_at,revision)
      select user_id,id,scene,updated_at,revision from jsonb_populate_recordset(null::public.visual_scenes,${tag}${payload}${tag}::jsonb);
    select count(*)::int as restored_scenes,
      coalesce(jsonb_agg(to_jsonb(s) order by s.user_id,s.id),'[]'::jsonb)=${tag}${payload}${tag}::jsonb as identical
    from fontex_restore_rehearsal s;
    rollback;`);
  assert.equal(rows[0]?.identical,true,'Restored scenes differ from the snapshot');
  console.log(JSON.stringify({result:'passed',scope:'production canvas snapshot restored to a temporary table then rolled back',scenes:rows[0].restored_scenes,productionDataChanged:false}));
} else {
  assert.ok(!input,'Use no arguments to create a snapshot, or --rehearse <snapshot.json>');
  const rows=query("select coalesce(jsonb_agg(to_jsonb(s) order by s.user_id,s.id),'[]'::jsonb) as scenes from public.visual_scenes s");
  const snapshot={version:1,project,at:new Date().toISOString(),scenes:rows[0].scenes};
  const path=resolve(`ops.local/backups/canvas-${new Date().toISOString().replaceAll(':','-')}.json`);
  const bytes=JSON.stringify(snapshot,null,2);
  writeFileSync(path,bytes);writeFileSync(path+'.sha256',hash(bytes));
  console.log(JSON.stringify({result:'saved',path,scenes:snapshot.scenes.length,sha256:hash(bytes)}));
}

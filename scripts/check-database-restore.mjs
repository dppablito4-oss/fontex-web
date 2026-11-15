import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Only the isolated local CI stack is supported. No remote URL or project-ref input.
const container = 'supabase_db_fontex-web';
const database = 'fontex_restore_rehearsal';
// Supabase's `postgres` is intentionally restricted. Restoring internal Realtime functions
// needs the isolated container's superuser, never the hosted project's application role.
const sql = (db, query) => execFileSync('docker', ['exec', container, 'psql', '-U', 'supabase_admin', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim();
assert.equal(sql('postgres', 'select current_database()'), 'postgres');
assert.equal(sql('postgres', 'select rolsuper from pg_roles where rolname=current_user'), 't');
const original = sql('postgres', 'select count(*) from supabase_migrations.schema_migrations');
const backup = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'], { maxBuffer: 128 * 1024 * 1024 });
assert.ok(backup.length > 1000);
try {
  sql('postgres', `create database ${database}`);
  execFileSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'supabase_admin', '-d', database, '--exit-on-error'], { input: backup, maxBuffer: 10 * 1024 * 1024 });
  assert.equal(sql(database, 'select count(*) from supabase_migrations.schema_migrations'), original);
  const count = "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fontex_ai'";
  assert.equal(sql(database, count), sql('postgres', count));
  assert.equal(sql(database, "select relrowsecurity from pg_class where oid='fontex_ai.canvas_builds'::regclass"), 't');
  console.log(JSON.stringify({ result: 'passed', migrations: Number(original), scope: 'isolated CI PostgreSQL backup and restore', productionTouched: false }));
} finally {
  // Literal disposable target, in the same isolated CI container.
  sql('postgres', `drop database if exists ${database} with (force)`);
}

// Explicit opt-in: this script makes four billed requests to the configured Edge Function.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { eventData } from '../src/core/agent/event-stream.ts';
import { applyPrimitivePatch, newPrimitiveScene } from '../src/core/primitives/schema.ts';
import { templateScene } from '../src/core/primitives/templates.ts';
const required = ['SUPABASE_TEST_URL', 'SUPABASE_TEST_PUBLISHABLE_KEY', 'FONTEX_TEST_EMAIL', 'FONTEX_TEST_PASSWORD'];
for (const name of required) assert.ok(process.env[name], `Missing ${name}`);
assert.equal(process.env.FONTEX_RUN_PAID_AGENT_TESTS, '1', 'Set FONTEX_RUN_PAID_AGENT_TESTS=1 to authorize four real AI requests.');
const client = createClient(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const login = await client.auth.signInWithPassword({ email: process.env.FONTEX_TEST_EMAIL, password: process.env.FONTEX_TEST_PASSWORD });
assert.ifError(login.error);
let scene = newPrimitiveScene('QA v0.7.1 - no persistir');
const covered = new Set();
async function ask(task, question, selectedId = null) {
  const response = await client.functions.invoke('studio-agent/primitives', {
    body: { scene, task, question, selectedId, level: 'secundaria' }, timeout: 60000,
  });
  assert.ifError(response.error);
  const stream = response.data instanceof ReadableStream ? response.data : response.data instanceof Response ? response.data.body : null;
  assert.ok(stream, 'Expected SSE response');
  let reply, deltas = 0;
  for await (const event of eventData(stream)) {
    if (event.type === 'error') throw Error(String(event.message));
    if (event.type === 'text') deltas++;
    if (event.type === 'result') reply = event.reply;
  }
  assert.ok(reply, 'Missing complete validated proposal');
  const next = applyPrimitivePatch(scene, reply, templateScene);
  reply.actions.forEach((a) => covered.add(a.kind));
  console.log(JSON.stringify({ task, actions: reply.actions.map((a) => a.kind), streamedTextEvents: deltas }));
  scene = next;
  return reply;
}
try {
  const chat = await ask('chat', 'Explica brevemente qué representa sumar 3 y −2 en una recta numérica. No construyas todavía.');
  assert.equal(chat.actions.length, 0);
  await ask('build', 'No cargues plantillas. Ejecuta upsert_variable para n=3, min=0, max=10, step=1, unit vacío. Añade exactamente dos math_block transparentes con add_primitive: etiqueta "QA conservar" y texto "n = {{n}}"; etiqueta "QA borrar" y texto "Temporal". Completa todos sus campos.');
  assert.ok(covered.has('upsert_variable') && covered.has('add_primitive'));
  const keep = scene.primitives.find((p) => p.label === 'QA conservar');
  const remove = scene.primitives.find((p) => p.label === 'QA borrar');
  assert.ok(keep && remove, 'Both requested primitives must exist');
  await ask('build', `Usa update_primitive para cambiar únicamente el texto del elemento ${keep.id} a "Actualizado: n = {{n}}" conservando su identidad. Usa delete_primitive para eliminar ${remove.id}. No agregues elementos ni cargues plantillas.`, keep.id);
  assert.ok(covered.has('update_primitive') && covered.has('delete_primitive'));
  assert.equal(scene.primitives.some((p) => p.id === remove.id), false);
  assert.match(scene.primitives.find((p) => p.id === keep.id).data.markdownContent, /Actualizado/);
  await ask('build', 'Reemplaza explícitamente todo este lienzo cargando la plantilla unit-circle mediante una única acción load_template.');
  assert.ok(covered.has('load_template'));
  assert.ok(scene.primitives.some((p) => p.kind === 'coordinate_canvas' && p.data.mode === 'unit_circle'));
  assert.equal(covered.size, 5);
  console.log(JSON.stringify({ result: 'passed', realProviderRequests: 4, actionKinds: [...covered], writesToDatabase: 0 }));
} finally {
  await client.auth.signOut({ scope: 'local' });
}

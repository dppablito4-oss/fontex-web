// Read-only release gate. No accounts, provider calls or database writes.
const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key || !key.startsWith("sb_publishable_") || new URL(url).protocol !== "https:") {
  throw Error("Configura explícitamente la URL HTTPS y clave publicable del backend destino.");
}
const base = url.replace(/\/$/, "");
const contract = await fetch(`${base}/rest/v1/rpc/get_release_contract`, {
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}", signal: AbortSignal.timeout(10000),
});
if (!contract.ok || await contract.json() !== "closed-beta-v4") {
  throw Error("El backend no acredita el contrato closed-beta-v4. Aplica y verifica las migraciones antes de publicar.");
}
// NULL cannot match a shared token: exercise the public read route without
// reading user content, creating an account, or publishing a snapshot.
const shared = await fetch(`${base}/rest/v1/rpc/read_public_canvas`, {
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ p_token: null }), signal: AbortSignal.timeout(10000),
});
if (!shared.ok || await shared.json() !== null) {
  throw Error("El backend no permite verificar la lectura pública de lienzos. Comprueba los RPC y la barrera beta antes de publicar.");
}
// Invalid credentials exercise the invitation routes without creating visitors
// or reading a real classroom. The frontend must not precede its migration.
for (const [rpc, args] of [["get_classroom_join_info", { p_invite: null }], ["get_classroom_guest", { p_token: null }]]) {
  const probe = await fetch(`${base}/rest/v1/rpc/${rpc}`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
  });
  if (!probe.ok || await probe.json() !== null) throw Error(`Falta el acceso temporal de aulas (${rpc}). Aplica y verifica su migración antes de publicar.`);
}
const learning = await fetch(`${base}/rest/v1/rpc/class_learning_contract`, {
  method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(10000),
});
if (!learning.ok || await learning.json() !== "classroom-learning-v092") throw Error("Falta la migración de actividades de aula v0.9.2.");
for (const endpoint of ["studio-agent", "scene-agent", "tutor-chat", "practice-tutor", "document-upload", "document-delete", "document-process", "document-search", "classroom-api", "classroom-agent"]) {
  const preflight = await fetch(`${base}/functions/v1/${endpoint}`, {
    method: "OPTIONS", headers: { Origin: "https://fontex-release-check.invalid", "Access-Control-Request-Method": "POST" },
    signal: AbortSignal.timeout(10000),
  });
  if (![200, 204].includes(preflight.status) || !preflight.headers.get("access-control-allow-origin")) {
    throw Error(`No se pudo verificar el preflight de ${endpoint}. Despliega y comprueba las funciones antes de publicar.`);
  }
  if (endpoint === "studio-agent" && preflight.headers.get("x-fontex-agent-contract") !== "primitive-agent-v7") {
    throw Error("studio-agent no acredita primitive-agent-v7. Despliega el agente con soporte de práctica antes de publicar.");
  }
  if (endpoint.startsWith("classroom-") && preflight.headers.get("x-fontex-classroom-contract") !== "classroom-learning-v092") throw Error(`Falta el contrato de actividades en ${endpoint}.`);
  const response = await fetch(`${base}/functions/v1/${endpoint}`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: endpoint === "classroom-api" ? JSON.stringify({lesson:"00000000-0000-4000-8000-000000000000"}) : "{}", signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 401) throw Error(`El endpoint ${endpoint} debe existir y rechazar peticiones sin sesión (401). Recibido: ${response.status}`);
}
console.log("Backend compatible: contrato SQL v4, lectura pública, invitaciones de aula, agente de práctica y 10 rutas protegidas verificados. La prueba autenticada se registra por separado.");

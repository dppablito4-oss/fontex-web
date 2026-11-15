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
if (!contract.ok || await contract.json() !== "closed-beta-v2") {
  throw Error("El backend no acredita el contrato closed-beta-v2. Aplica y verifica las migraciones antes de publicar.");
}
for (const endpoint of ["studio-agent", "scene-agent", "tutor-chat", "practice-tutor", "document-upload", "document-delete", "document-process", "document-search"]) {
  const preflight = await fetch(`${base}/functions/v1/${endpoint}`, {
    method: "OPTIONS", headers: { Origin: "https://fontex-release-check.invalid", "Access-Control-Request-Method": "POST" },
    signal: AbortSignal.timeout(10000),
  });
  if (![200, 204].includes(preflight.status) || !preflight.headers.get("access-control-allow-origin")) {
    throw Error(`No se pudo verificar el preflight de ${endpoint}. Despliega y comprueba las funciones antes de publicar.`);
  }
  const response = await fetch(`${base}/functions/v1/${endpoint}`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: "{}", signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 401) throw Error(`El endpoint ${endpoint} debe existir y rechazar peticiones sin sesión (401). Recibido: ${response.status}`);
}
console.log("Backend compatible: contrato SQL y 8 rutas protegidas verificados. La prueba autenticada se registra por separado.");

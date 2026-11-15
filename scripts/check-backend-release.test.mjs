// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from "vitest";
beforeEach(()=>{
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL","https://backend.example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY","sb_publishable_test_only");
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function backend({contract="closed-beta-v2",preflight=204,unauthenticated=401}={}){
  return vi.fn((url,options)=>Promise.resolve(String(url).includes("/rest/")
    ? Response.json(contract)
    : new Response(null,{status:options.method==="OPTIONS"?preflight:unauthenticated,headers:{"access-control-allow-origin":"*"}})));
}
it("refuses to fall back to a pilot project when target configuration is absent",async()=>{
  vi.stubEnv("VITE_SUPABASE_URL","");
  const fetch=backend();vi.stubGlobal("fetch",fetch);
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("Configura explícitamente");
  expect(fetch).not.toHaveBeenCalled();
});
it("blocks a backend with an incompatible schema contract",async()=>{
  vi.stubGlobal("fetch",backend({contract:"old-version"}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("no acredita el contrato");
});
it("blocks missing routes and endpoints accepting unauthenticated calls",async()=>{
  vi.stubGlobal("fetch",backend({preflight:404}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("preflight");
  vi.resetModules();vi.stubGlobal("fetch",backend({unauthenticated:200}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("rechazar peticiones sin sesión");
});
it("checks the SQL contract, CORS and authentication without credentials or AI calls",async()=>{
  const fetch=backend();vi.stubGlobal("fetch",fetch);
  await import("./check-backend-release.mjs");
  expect(fetch).toHaveBeenCalledTimes(17);
  expect(fetch.mock.calls.every(([url])=>String(url).startsWith("https://backend.example.invalid/"))).toBe(true);
  expect(fetch.mock.calls.every(([,options])=>!options.headers.Authorization)).toBe(true);
});

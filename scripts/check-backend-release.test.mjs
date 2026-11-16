// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from "vitest";
beforeEach(()=>{
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL","https://backend.example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY","sb_publishable_test_only");
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function backend({contract="closed-beta-v4",preflight=204,unauthenticated=401,sharedStatus=200,sharedBody=null,guestStatus=200,agentContract="primitive-agent-v6",learningContract="classroom-learning-v092"}={}){
  return vi.fn((url,options)=>Promise.resolve(String(url).endsWith("/rpc/get_release_contract")
    ? Response.json(contract)
    : String(url).endsWith("/rpc/class_learning_contract")
    ? Response.json(learningContract)
    : String(url).endsWith("/rpc/read_public_canvas")
    ? Response.json(sharedBody,{status:sharedStatus})
    : /\/rpc\/(get_classroom_join_info|get_classroom_guest)$/.test(String(url))
    ? Response.json(null,{status:guestStatus})
    : new Response(null,{status:options.method==="OPTIONS"?preflight:unauthenticated,headers:{"access-control-allow-origin":"*","x-fontex-agent-contract":agentContract,"x-fontex-classroom-contract":learningContract}})));
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
it("blocks the previous backend even when its existing endpoints are healthy",async()=>{
  const fetch=backend({contract:"closed-beta-v2"});vi.stubGlobal("fetch",fetch);
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("closed-beta-v4");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([404,403])("blocks an absent or membership-protected public RPC (%s)",async sharedStatus=>{
  vi.stubGlobal("fetch",backend({sharedStatus}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("lectura pública");
});
it("rejects a public reader returning unexpected content for a null token",async()=>{
  vi.stubGlobal("fetch",backend({sharedBody:{title:"Unexpected document"}}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("lectura pública");
});
it.each(["","primitive-agent-v2"])("blocks an agent without the practice contract (%s)",async agentContract=>{
  vi.stubGlobal("fetch",backend({agentContract}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("primitive-agent-v6");
});
it("blocks publication until the guest classroom migration is installed",async()=>{
  vi.stubGlobal("fetch",backend({guestStatus:404}));
  await expect(import("./check-backend-release.mjs")).rejects.toThrow("acceso temporal de aulas");
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
  expect(fetch).toHaveBeenCalledTimes(25);
  expect(fetch.mock.calls.every(([url])=>String(url).startsWith("https://backend.example.invalid/"))).toBe(true);
  expect(fetch.mock.calls.every(([,options])=>!options.headers.Authorization)).toBe(true);
  const publicRead=fetch.mock.calls.find(([url])=>String(url).endsWith("/rpc/read_public_canvas"));
  expect(JSON.parse(publicRead[1].body)).toEqual({p_token:null});
});

it("blocks publication before classroom activities are available",async()=>{
 vi.stubGlobal("fetch",backend({learningContract:"old"}));
 await expect(import("./check-backend-release.mjs")).rejects.toThrow("actividades de aula v0.9.2");
});

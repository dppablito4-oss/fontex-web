import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminMfaGate } from "./AdminMfaGate";
const mock = vi.hoisted(() => ({ assurance:vi.fn(), factors:vi.fn(), enroll:vi.fn(), verify:vi.fn(), unenroll:vi.fn() }));
vi.mock("../../lib/supabase/client", () => ({ supabase: { auth:{ mfa:{ getAuthenticatorAssuranceLevel:mock.assurance, listFactors:mock.factors, enroll:mock.enroll, challengeAndVerify:mock.verify, unenroll:mock.unenroll } } } }));
const identity = { id:"admin" };
vi.mock("./AuthProvider", () => ({ useAuth:() => ({ user:identity,session:{access_token:"test-token"} }) }));
beforeEach(() => {
  vi.resetAllMocks();
  mock.assurance.mockResolvedValue({data:{currentLevel:"aal1"},error:null});
  mock.factors.mockResolvedValue({data:{totp:[]},error:null});
});
it("does not mount administrative data until the session has aal2", async () => {
  const privateView = vi.fn(() => <p>Administración privada</p>);
  const Private = privateView;
  render(<AdminMfaGate><Private /></AdminMfaGate>);
  await screen.findByRole("button",{name:"Configurar autenticador"});
  expect(privateView).not.toHaveBeenCalled();
});
it("enrolls and verifies a TOTP factor before showing the protected panel", async () => {
  mock.enroll.mockResolvedValue({data:{id:"factor",totp:{qr_code:"data:image/svg+xml,test",secret:"TEST"}},error:null});
  mock.verify.mockImplementation(() => {mock.assurance.mockResolvedValue({data:{currentLevel:"aal2"},error:null});return Promise.resolve({data:{},error:null});});
  render(<AdminMfaGate><p>Administración privada</p></AdminMfaGate>);
  fireEvent.click(await screen.findByRole("button",{name:"Configurar autenticador"}));
  await screen.findByRole("img",{name:/Código QR/});
  fireEvent.change(screen.getByLabelText("Código del autenticador"),{target:{value:"123456"}});
  fireEvent.click(screen.getByRole("button",{name:"Verificar y continuar"}));
  await screen.findByText("Administración privada");
  expect(mock.verify).toHaveBeenCalledWith({factorId:"factor",code:"123456"});
});
it("invalid codes leave the panel locked", async () => {
  mock.factors.mockResolvedValue({data:{totp:[{id:"factor",status:"verified"}]},error:null});
  mock.verify.mockResolvedValue({error:{message:"invalid"}});
  render(<AdminMfaGate><p>Administración privada</p></AdminMfaGate>);
  const code = await screen.findByLabelText("Código del autenticador");
  fireEvent.change(code,{target:{value:"000000"}}); fireEvent.click(screen.getByRole("button",{name:"Verificar y continuar"}));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no es válido"));
  expect(screen.queryByText("Administración privada")).not.toBeInTheDocument();
});

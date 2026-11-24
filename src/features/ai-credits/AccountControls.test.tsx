import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import {AccountControls} from "./AccountControls";
const mock=vi.hoisted(()=>({action:vi.fn(),history:vi.fn()}));
vi.mock("./account-controls",async original=>({...await original<typeof import("./account-controls")>(),accountAction:mock.action,accountHistory:mock.history}));
const account={user_id:"accc0000-0000-4000-8000-000000000002",email:"student@example.invalid",display_name:"Estudiante",credits:5,created_at:"2026-11-24",is_admin:false,status:"active" as const};
beforeEach(()=>{mock.action.mockReset().mockResolvedValue(undefined);mock.history.mockReset().mockResolvedValue([]);});
it("requires explicit identity and reason before deleting only Fontex",async()=>{
 const updated=vi.fn().mockResolvedValue(undefined);render(<AccountControls account={account} onUpdated={updated}/>);
 fireEvent.change(screen.getByLabelText("Acción sobre la cuenta"),{target:{value:"delete"}});
 const submit=screen.getByRole("button",{name:"Eliminar de Fontex"});expect(submit).toBeDisabled();
 fireEvent.change(screen.getByLabelText("Motivo de la operación"),{target:{value:"Solicitud de baja"}});
 fireEvent.change(screen.getByLabelText("Confirma el correo para eliminar"),{target:{value:"other@example.invalid"}});expect(submit).toBeDisabled();
 fireEvent.change(screen.getByLabelText("Confirma el correo para eliminar"),{target:{value:account.email}});fireEvent.click(submit);
 await waitFor(()=>expect(updated).toHaveBeenCalledOnce());expect(mock.action).toHaveBeenCalledWith(account.user_id,"delete","Solicitud de baja",24,account.email,expect.any(String));
});
it("protects administrator accounts while leaving their credit management separate",()=>{render(<AccountControls account={{...account,is_admin:true}} onUpdated={vi.fn()}/>);expect(screen.queryByLabelText("Acción sobre la cuenta")).not.toBeInTheDocument();expect(screen.getByText(/protegida contra/)).toBeInTheDocument();});
it("retries a failed deletion with the same request identity",async()=>{
 mock.action.mockRejectedValueOnce(Error("Reintenta"));render(<AccountControls account={account} onUpdated={vi.fn().mockResolvedValue(undefined)}/>);
 fireEvent.change(screen.getByLabelText("Acción sobre la cuenta"),{target:{value:"delete"}});fireEvent.change(screen.getByLabelText("Motivo de la operación"),{target:{value:"Eliminar personales"}});fireEvent.change(screen.getByLabelText("Confirma el correo para eliminar"),{target:{value:account.email}});
 fireEvent.click(screen.getByRole("button",{name:"Eliminar de Fontex"}));await screen.findByRole("alert");fireEvent.click(screen.getByRole("button",{name:"Eliminar de Fontex"}));await waitFor(()=>expect(mock.action).toHaveBeenCalledTimes(2));expect(mock.action.mock.calls[0]![5]).toBe(mock.action.mock.calls[1]![5]);
});

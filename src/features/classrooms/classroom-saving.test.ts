import {beforeEach,expect,it,vi} from "vitest";
import {newPrimitiveScene} from "../../core/primitives/schema";
import {adoptClassroomCanvases,guestOwner,saveClassroomCanvases,type ClassroomGuest} from "./classroom-access";
const mock=vi.hoisted(()=>({from:vi.fn(),list:vi.fn(),insert:vi.fn()}));
vi.mock("../../lib/supabase/client",()=>({supabase:{from:mock.from}}));
const guest:ClassroomGuest={id:"c0920000-0000-4000-8000-000000000001",token:"a".repeat(64),classroom_id:"c0920000-0000-4000-8000-000000000002",display_name:"Ana",title:"Clase",expires_at:"2026-12-01T00:00:00Z"};
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mock.from.mockImplementation(()=>({select:()=>({eq:()=>({in:mock.list})}),insert:mock.insert}));});
it("preserves imported IDs after a partial upload and only retries missing cloud documents",async()=>{
 const originals=[newPrimitiveScene("Primero"),newPrimitiveScene("Segundo")];
 const sourceKey=`fontex-primitives-v2:${guestOwner(guest.id)}`;
 localStorage.setItem(sourceKey,JSON.stringify({scenes:originals,activeId:originals[0]!.id}));
 const copies=adoptClassroomCanvases(guest,"account");
 mock.list.mockResolvedValueOnce({data:[],error:null});
 mock.insert.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{code:"503"}});
 await expect(saveClassroomCanvases("account",copies)).rejects.toThrow(/Conservamos la copia local/);
 const retried=adoptClassroomCanvases(guest,"account");expect(retried).toEqual(copies);
 mock.list.mockResolvedValueOnce({data:[{id:copies[0]!.id}],error:null});mock.insert.mockResolvedValueOnce({error:null});
 await saveClassroomCanvases("account",retried);
 expect(mock.insert).toHaveBeenCalledTimes(3);
 expect(mock.insert.mock.calls[2]![0]).toMatchObject({user_id:"account",id:copies[1]!.id,revision:1});
 expect(JSON.parse(localStorage.getItem(sourceKey)!)).toEqual({scenes:originals,activeId:originals[0]!.id});
 mock.list.mockResolvedValueOnce({data:copies.map(s=>({id:s.id})),error:null});
 await saveClassroomCanvases("account",retried);expect(mock.insert).toHaveBeenCalledTimes(3);
});
it("does not attempt uploads when it cannot verify the existing cloud documents",async()=>{
 mock.list.mockResolvedValue({data:null,error:{code:"403"}});
 await expect(saveClassroomCanvases("account",[newPrimitiveScene()])).rejects.toThrow(/copia temporal sigue disponible/);
 expect(mock.insert).not.toHaveBeenCalled();
});

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useBuildRecovery } from "./useBuildRecovery";
import { createPrimitive, newPrimitiveScene } from "../../core/primitives/schema";
const mock = vi.hoisted(() => ({ list:vi.fn(),get:vi.fn(),ack:vi.fn() }));
vi.mock("./buildRecovery",async () => ({ ...await vi.importActual("./buildRecovery"),listCanvasBuilds:mock.list,getCanvasBuild:mock.get,acknowledgeCanvasBuild:mock.ack }));
beforeEach(() => { vi.resetAllMocks(); mock.list.mockResolvedValue([]);mock.ack.mockResolvedValue(undefined); });
const id="fc010001-0000-4000-8000-000000000001";
const item={id,state:"ready",created_at:new Date().toISOString(),applied_at:null};
it("never reapplies an acknowledged proposal after undoing its local contents",async () => {
  const scene=newPrimitiveScene();mock.list.mockResolvedValue([{...item,applied_at:new Date().toISOString()}]);
  const apply=vi.fn();renderHook(() => useBuildRecovery({authenticated:true,scene,status:"saved",busy:false,current:()=>scene,apply}));
  await waitFor(() => expect(mock.list).toHaveBeenCalled());
  expect(mock.get).not.toHaveBeenCalled();expect(apply).not.toHaveBeenCalled();
});
it("acknowledges only after the recovered scene has synchronized",async () => {
  const scene={...newPrimitiveScene(),appliedBuildIds:[id]};
  const view=renderHook(({status}) => useBuildRecovery({authenticated:true,scene,status,busy:false,current:()=>scene,apply:vi.fn()}),{initialProps:{status:"saving"}});
  expect(mock.ack).not.toHaveBeenCalled();view.rerender({status:"saved"});
  await waitFor(() => expect(mock.ack).toHaveBeenCalledWith(id));
});
it("offers a separate recovery when the scene changed instead of overwriting edits",async () => {
  const source=newPrimitiveScene();const scene={...source,primitives:[createPrimitive("math_block",source)]};
  mock.list.mockResolvedValue([item]);mock.get.mockResolvedValue({...item,source,question:"Construye una fracción",reply:{message:"Resultado",actions:[]}});
  const apply=vi.fn();const view=renderHook(() => useBuildRecovery({authenticated:true,scene,status:"saved",busy:false,current:()=>scene,apply}));
  await waitFor(() => expect(view.result.current.available).toHaveLength(1));expect(apply).not.toHaveBeenCalled();
});

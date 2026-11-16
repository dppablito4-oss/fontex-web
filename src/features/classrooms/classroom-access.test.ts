import { beforeEach, describe, expect, it } from "vitest";
import { newPrimitiveScene } from "../../core/primitives/schema";
import { adoptClassroomCanvases, guestOwner, inviteValue, readClassroomGuest, storeClassroomGuest, type ClassroomGuest } from "./classroom-access";

const guest: ClassroomGuest = { id: "c1a55000-0000-4000-8000-000000000001", classroom_id: "c1a55000-0000-4000-8000-000000000002", token: "a".repeat(64), display_name: "Ana", title: "Modelo", expires_at: "2026-12-01T00:00:00Z" };
beforeEach(() => localStorage.clear());
describe("classroom participation", () => {
  it("accepts a copied invitation URL or code", () => {
    expect(inviteValue("https://fontex.example/#/unirse?invite=abc123")).toBe("abc123");
    expect(inviteValue(" AB12-CD34-EF56 ")).toBe("AB12-CD34-EF56");
  });
  it("restores a valid guest and ignores damaged browser state", () => {
    storeClassroomGuest(guest);
    expect(readClassroomGuest()).toEqual(guest);
    localStorage.setItem("fontex-classroom-guest-v1", "{}");
    expect(readClassroomGuest()).toBeNull();
  });
  it("preserves guest work, account work and active document across upgrade and retries", () => {
    const first = newPrimitiveScene("Mi clase"), second = newPrimitiveScene("Mi ejercicio"), existing = newPrimitiveScene("Ya guardado");
    const sourceKey = `fontex-primitives-v2:${guestOwner(guest.id)}`;
    localStorage.setItem(sourceKey, JSON.stringify({ scenes: [first, second], activeId: second.id }));
    localStorage.setItem("fontex-primitives-v2:account", JSON.stringify({ scenes: [existing], activeId: existing.id }));
    adoptClassroomCanvases(guest, "account");
    const result = JSON.parse(localStorage.getItem("fontex-primitives-v2:account")!) as { scenes: typeof first[]; activeId: string };
    expect(result.scenes.map(s => s.title)).toEqual(["Ya guardado", "Mi clase", "Mi ejercicio"]);
    expect(result.scenes[0]).toEqual(existing);
    expect(result.scenes[1]!.id).not.toBe(first.id);
    expect(result.activeId).toBe(result.scenes[2]!.id);
    expect(JSON.parse(localStorage.getItem(sourceKey)!)).toEqual({ scenes: [first, second], activeId: second.id });
    adoptClassroomCanvases(guest, "account");
    expect(JSON.parse(localStorage.getItem("fontex-primitives-v2:account")!)).toEqual(result);
  });
});

import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
import { parsePrimitiveScene } from "../../core/primitives/schema";

export const guestSchema = z.object({
  id: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/),
  display_name: z.string().min(1).max(80), classroom_id: z.string().uuid(),
  title: z.string(), expires_at: z.string().datetime({ offset: true }),
});
export type ClassroomGuest = z.infer<typeof guestSchema>;
export const guestStorageKey = "fontex-classroom-guest-v1";
export const guestOwner = (id: string) => `guest:${id}`;

export function readClassroomGuest() {
  try { return guestSchema.parse(JSON.parse(localStorage.getItem(guestStorageKey) ?? "null")); }
  catch { return null; }
}
export function storeClassroomGuest(guest: ClassroomGuest | null) {
  if (guest) localStorage.setItem(guestStorageKey, JSON.stringify(guest));
  else localStorage.removeItem(guestStorageKey);
  window.dispatchEvent(new Event("fontex-classroom-guest"));
}
export function inviteValue(input: string) {
  const value = input.trim();
  try {
    const url = new URL(value);
    return new URLSearchParams(url.hash.split("?")[1]).get("invite") ?? value;
  } catch { return value; }
}
export function classroomAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("classroom_name_required")) return "Escribe tu nombre (hasta 80 caracteres).";
  if (message.includes("classroom_guest_limit")) return "Esta invitación llegó al límite de participantes. Pide al docente que la renueve.";
  if (message.includes("classroom_membership_removed")) return "El docente retiró tu matrícula. Pídele que habilite tu acceso.";
  if (message.includes("expired")) return "El acceso venció o fue desactivado. Pide un enlace o código nuevo al docente.";
  if (message.includes("verified_account")) return "Confirma primero tu correo para conservar tu matrícula.";
  if (message.includes("permission_denied")) return "Tu cuenta no tiene permiso para realizar esta acción.";
  return "No pudimos conectar con el aula. Comprueba tu conexión e inténtalo de nuevo.";
}
export function classroomClient() {
  if (!supabase) throw Error("El acceso a aulas no está disponible en esta versión.");
  return supabase;
}

// Copy before switching to the account editor. Keep the guest backup until its
// new owner has synced; imported IDs cannot overwrite existing cloud documents.
export function adoptClassroomCanvases(guest: ClassroomGuest, userId: string) {
  const targetKey = `fontex-primitives-v2:${userId}`;
  const marker = `${targetKey}:classroom-import:${guest.id}`;
  if (localStorage.getItem(marker)) return;
  const source = JSON.parse(localStorage.getItem(`fontex-primitives-v2:${guestOwner(guest.id)}`) ?? "null") as { scenes?: unknown[]; activeId?: string } | null;
  if (!source?.scenes?.length) return;
  const target = JSON.parse(localStorage.getItem(targetKey) ?? "null") as { scenes?: unknown[]; activeId?: string } | null;
  const existing = (target?.scenes ?? []).map(parsePrimitiveScene);
  const ids = new Map<string, string>();
  const copies = source.scenes.map(value => {
    const scene = parsePrimitiveScene(value), id = crypto.randomUUID();
    ids.set(scene.id, id);
    return { ...scene, id, updatedAt: new Date().toISOString() };
  });
  if (copies.length + existing.length > 100) throw Error("Tu biblioteca está llena. Exporta tus lienzos temporales como JSON antes de continuar.");
  localStorage.setItem(targetKey, JSON.stringify({ scenes: [...existing, ...copies], activeId: ids.get(source.activeId ?? "") ?? copies[0]!.id }));
  localStorage.setItem(marker, "1");
}

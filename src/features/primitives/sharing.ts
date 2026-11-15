import { supabase } from "../../lib/supabase/client";
import { parsePrimitiveScene } from "../../core/primitives/schema";
export async function publishCanvas(id: string) {
  if (!supabase) throw Error("Inicia sesión para compartir el lienzo.");
  const { data, error } = await supabase.rpc("publish_canvas", { p_scene_id: id });
  if (error || !data) throw Error("No se pudo crear el enlace público. Comprueba que el lienzo esté guardado.");
  return `${window.location.origin}${import.meta.env.BASE_URL}#/compartido/${data}`;
}
export async function readPublicCanvas(token: string) {
  if (!supabase) throw Error("No se pudo conectar con Fontex.");
  const { data, error } = await supabase.rpc("read_public_canvas", { p_token: token });
  if (error || !data) throw Error("Este enlace no está disponible o su autor dejó de compartirlo.");
  return parsePrimitiveScene(data);
}
export async function revokeCanvas(id: string, owner: string) {
  if (!supabase) throw Error("Inicia sesión para gestionar el enlace.");
  const { error } = await supabase.from("canvas_public_shares").delete().eq("scene_id", id).eq("user_id", owner);
  if (error) throw Error("No se pudo desactivar el enlace.");
}

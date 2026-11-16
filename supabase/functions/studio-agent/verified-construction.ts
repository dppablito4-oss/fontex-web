import {
  parsePrimitiveScene,
  type PrimitiveReply,
  type PrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
import { templateScene } from "../../../src/core/primitives/templates.ts";
// This public lesson was reviewed and tested. Reuse it only for the exact
// normalized request on an untouched canvas; custom requests still use AI.
const kinematicsRequestHash =
  "7b4d0f3d1b8ad975955f4f583b1136f3fc217fdad09d47b39fb3e58bf9d0ff32";
export async function verifiedConstruction(
  scene: PrimitiveScene,
  question: string,
): Promise<PrimitiveReply | null> {
  const v = scene.variables[0];
  const defaultVariables = scene.variables.length === 0 ||
    scene.variables.length === 1 && v?.name === "a" && v.value === 1 &&
      v.min === -5 && v.max === 5 && v.step === .1 && v.unit === "";
  if (scene.primitives.length || !defaultVariables) return null;
  const normalized = question.trim().toLowerCase().replace(/\s+/g, " ");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  const hash = Array.from(
    new Uint8Array(digest),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== kinematicsRequestHash) return null;
  const preset = parsePrimitiveScene(templateScene("kinematics-integrated"));
  return {
    message:
      "Cargué la composición de cinemática ya validada, sin consumir créditos de IA. Puedes modificar los controles y practicar. Los colores condicionales de enlaces y la calificación automática no están disponibles.",
    actions: [
      ...preset.variables.map((variable) => ({
        kind: "upsert_variable" as const,
        variable,
      })),
      ...preset.primitives.map((primitive) => ({
        kind: "add_primitive" as const,
        primitive,
      })),
    ],
  };
}

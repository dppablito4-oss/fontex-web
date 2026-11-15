import type { PrimitiveScene } from "../../core/primitives/schema";
export function contextualTitle(scene: PrimitiveScene, question: string) {
  if (!/^(mi lienzo|lienzo(?: sin título)?(?: \d+)?|sin título(?: \d+)?)$/i.test(scene.title.trim())) return scene.title;
  const heading = scene.primitives.find(p => p.kind === "math_block")?.data;
  const content = heading && "markdownContent" in heading ? String(heading.markdownContent) : "";
  const title = content.match(/^#{1,3}\s+(.+)$/m)?.[1]
    ?? question.replace(/^(?:por favor[, ]*|crea(?:r)?|genera(?:r)?|construye|haz|quiero|un lienzo|una lección|sobre|acerca de)\s*/gi, "").trim();
  const clean = title.replace(/[*#`$]/g, "").replace(/\s+/g, " ").slice(0, 100).trim();
  return clean ? clean[0]!.toLocaleUpperCase("es") + clean.slice(1) : scene.title;
}

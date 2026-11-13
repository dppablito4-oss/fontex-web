import { expect, it } from "vitest";
import { createDocument, createObject, objectRegistry } from "../../core/object-registry/registry";
import { migrateMaterial } from "./scene-migration";
import { parseScene } from "../../core/scene/document";
it("preserves every previous representation and its conversation in an editable migrated scene",()=>{
 const doc=createDocument("blank");doc.objects=(Object.keys(objectRegistry) as (keyof typeof objectRegistry)[]).map(t=>createObject(t));
 const chat=[{role:"user" as const,content:"Explica las fracciones"},{role:"assistant" as const,content:"Observa las partes"}];
 const scene=migrateMaterial(doc,chat);expect(scene.id).toBe(`import-${doc.id}`);expect(scene.elements).toHaveLength(doc.objects.length);expect(scene.conversation).toEqual(chat);
 for(const object of doc.objects){const node=scene.elements.find(e=>e.kind==="legacy"&&e.object.id===object.id);expect(node?.kind==="legacy"?node.object:null).toEqual(object);}
 expect(parseScene(JSON.parse(JSON.stringify(scene)) as unknown)).toEqual(scene);
});

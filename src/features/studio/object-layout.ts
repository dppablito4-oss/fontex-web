import type { ActionBatch } from "../../core/agent/actions";
import type { StudioDocument } from "../../core/document-schema/document";
import { BOARD, maxObjectHeight, type MathObject } from "../../core/document-schema/document";

export function resizeObject(
  object: MathObject,
  width: number,
  height: number,
): MathObject {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return object;
  return {
    ...object,
    width: Math.max(240, Math.min(BOARD.width - object.x, width)),
    height: Math.max(160, Math.min(maxObjectHeight(object), height)),
  };
}

/** Readable defaults for generated content, preserving existing manual layouts. */
export function readableBatch(batch: ActionBatch, document: StudioDocument): ActionBatch {
  let bottom = Math.max(20, ...document.objects.map(o => o.y + o.height));
  return { ...batch, actions: batch.actions.map(action => {
    if (action.kind !== "create") return action;
    const object = { ...action.object, x: 60, y: bottom + 40, width: 1100, height: action.object.type === "text" ? 360 : 720 };
    bottom = object.y + object.height;
    return { ...action, object };
  }) };
}
export function organizeObjects(objects: MathObject[]): MathObject[] {
  let y = 50;
  return [...objects].sort((a, b) => a.y - b.y || a.x - b.x).map(object => {
    const next = { ...object, x: 60, y, width: 1100, height: object.type === "text" ? 360 : 720 };
    y += next.height + 40;
    return next;
  });
}

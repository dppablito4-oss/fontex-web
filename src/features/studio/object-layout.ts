import type { ActionBatch } from "../../core/agent/actions";
import type { StudioDocument } from "../../core/document-schema/document";
import { BOARD, fitObject, maxObjectHeight, type MathObject } from "../../core/document-schema/document";

export function resizeObject(
  object: MathObject,
  width: number,
  height: number,
): MathObject {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return object;
  return {
    ...object,
    width: Math.max(240, Math.min(BOARD.width - object.x, width)),
    height: Math.max(160, Math.min(maxObjectHeight(), height)),
    ...(height === object.height ? {} : { autoHeight: false }),
  };
}

/** Readable defaults for generated content, preserving existing manual layouts. */
export function readableBatch(batch: ActionBatch, document: StudioDocument): ActionBatch {
  let bottom = Math.max(20, ...document.objects.map(o => o.y + o.height));
  return { ...batch, actions: batch.actions.map(action => {
    if (action.kind !== "create") return action;
    const object = wideObject({ ...action.object, x: 60, y: bottom + 40, width: 1100, height: action.object.type === "text" ? 360 : 720 });
    bottom = object.y + object.height;
    return { ...action, object };
  }) };
}
export function organizeObjects(objects: MathObject[]): MathObject[] {
  let y = 50;
  return [...objects].sort((a, b) => a.y - b.y || a.x - b.x).map(object => {
    const next = { ...object, x: 60, y, autoHeight: true };
    y += next.height + 40;
    return next;
  });
}

/** Resize from intrinsic content, moving following cards in the same column in both directions. */
export function fitContentHeights(objects: MathObject[], heights: Record<string, number>): MathObject[] {
  let result = objects;
  for (const original of [...objects].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const object = result.find(item => item.id === original.id)!;
    const measured = heights[object.id];
    if (object.autoHeight === false || !Number.isFinite(measured)) continue;
    const height = Math.max(160, Math.min(maxObjectHeight(), Math.ceil(measured!)));
    if (Math.abs(height - object.height) <= 1) continue;
    const delta = height - object.height, bottom = object.y + object.height;
    result = result.map(item => item.id === object.id ? fitObject({ ...item, height })
      : item.y >= bottom - 1 && item.x < object.x + object.width && item.x + item.width > object.x
        ? fitObject({ ...item, y: item.y + delta }) : item);
  }
  return result;
}

/** Give diagrams room for legible measurements and a full-width number line. */
export function wideObject(object: MathObject): MathObject {
  return ["function-graph", "fraction", "operation", "number-line", "geometry", "regular-polygon", "polygon", "circle", "angle"].includes(object.type)
    ? { ...object, width: BOARD.width - 120, height: object.type === "number-line" ? 700 : 1000 }
    : object;
}

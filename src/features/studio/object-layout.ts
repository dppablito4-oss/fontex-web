import { BOARD, type MathObject } from "../../core/document-schema/document";

export function resizeObject(
  object: MathObject,
  width: number,
  height: number,
): MathObject {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return object;
  return {
    ...object,
    width: Math.max(240, Math.min(BOARD.width - object.x, width)),
    height: Math.max(160, Math.min(BOARD.height, height)),
  };
}

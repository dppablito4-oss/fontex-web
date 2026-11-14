export const CANVAS_WORKSPACE_ID = "canvas-workspace-v1";
export const CANVAS_WORKSPACE_FORMAT = "canvas-workspace";
export const MAX_CANVAS_WORKSPACE_BYTES = 2 * 1024 * 1024;
export const isCanvasWorkspace = (value: unknown): boolean => !!value && typeof value === "object" &&
  "id" in value && value.id === CANVAS_WORKSPACE_ID && "format" in value && value.format === CANVAS_WORKSPACE_FORMAT;

export const isPrimitiveScene = (value: unknown): boolean => !!value && typeof value === "object" && "format" in value && value.format === "primitive-scene";

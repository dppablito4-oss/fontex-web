export const canvasTabId = (id: string) => `canvas-tab-${Array.from(id, (char) => (char.codePointAt(0) ?? 0).toString(16)).join("-")}`;

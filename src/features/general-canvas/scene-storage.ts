export const sceneCacheKey = (owner: string) => `fontex-scenes-v1:${owner}`;

export function isRetiredScene(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if ("id" in value && typeof value.id === "string" && value.id.startsWith("import-")) return true;
  return "elements" in value && Array.isArray(value.elements) && value.elements.some((element: unknown) =>
    !!element && typeof element === "object" && "kind" in element && element.kind === "legacy");
}

/** Remove retired test materials, never Auth, preferences or native scenes. */
export function clearRetiredMaterials(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key) continue;
    if (/^fontex-(?:studio-(?:v1|v2|chat-v1|sync-v1):|general-prototype:)/.test(key)) {
      storage.removeItem(key);
      continue;
    }
    if (!key.startsWith("fontex-scenes-v1:") || key.endsWith(":ack")) continue;
    try {
      const raw: unknown = JSON.parse(storage.getItem(key) ?? "null");
      if (!raw || typeof raw !== "object" || !("scenes" in raw) || !Array.isArray(raw.scenes)) continue;
      const scenes: unknown[] = raw.scenes;
      if (!scenes.some(isRetiredScene)) continue;
      const kept = scenes.filter(scene => !isRetiredScene(scene));
      const ids = kept.flatMap((scene: unknown) => scene && typeof scene === "object" && "id" in scene && typeof scene.id === "string" ? [scene.id] : []);
      const activeId = "activeId" in raw && ids.includes(String(raw.activeId)) ? raw.activeId : ids[0] ?? "";
      storage.setItem(key, JSON.stringify({ activeId, scenes: kept }));
      storage.removeItem(`${key}:ack`);
    } catch { /* Unreadable native scenes remain available for recovery. */ }
  }
}

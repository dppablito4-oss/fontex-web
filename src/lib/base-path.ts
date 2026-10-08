export function resolveBasePath(value?: string): string {
  const candidate = value?.trim();

  if (!candidate || candidate === "/") {
    return "/";
  }

  return `/${candidate.replace(/^\/+|\/+$/g, "")}/`;
}

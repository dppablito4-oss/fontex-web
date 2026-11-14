/** Angles use viewport coordinates, so rotation also works on a zoomed board. */
export function draggedRotation(
  initial: number,
  center: readonly [number, number],
  start: readonly [number, number],
  current: readonly [number, number],
  snap = false,
): number {
  const angle = (p: readonly [number, number]) =>
    Math.atan2(p[1] - center[1], p[0] - center[0]);
  const delta = Math.atan2(
    Math.sin(angle(current) - angle(start)),
    Math.cos(angle(current) - angle(start)),
  );
  const degrees = initial + delta * 180 / Math.PI;
  const value = snap
    ? Math.round(degrees / 15) * 15
    : Math.round(degrees * 10) / 10;
  return ((value + 180) % 360 + 360) % 360 - 180;
}

import { describe, expect, it } from "vitest";
import { draggedRotation } from "./gestures";
describe("rotation gestures", () => {
  it("rotates about the viewport center and composes with an existing rotation", () => {
    expect(draggedRotation(20, [400, 300], [400, 200], [500, 300])).toBe(110);
    expect(draggedRotation(20, [200, 150], [200, 100], [250, 150])).toBe(110);
  });
  it("snaps the resulting angle to 15 degrees when Shift is held", () => {
    expect(draggedRotation(7, [0, 0], [0, -10], [10, -1], true)).toBe(90);
  });
  it("crosses the atan2 branch without an almost-full-turn jump", () => {
    expect(draggedRotation(0, [0, 0], [-10, .1], [-10, -.1])).toBeCloseTo(1.1);
  });
});

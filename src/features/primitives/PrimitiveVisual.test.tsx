import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { templateScene } from "../../core/primitives/templates";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
function draw(id: string, value?: number) {
  const scene = templateScene(id);
  if (value !== undefined) {
    scene.variables.find((v) => v.name === "b")!.value = value;
  }
  const p = scene.primitives[0]!;
  const onSelect = vi.fn();
  return {
    ...render(
      <PrimitiveVisual
        p={p}
        scene={scene}
        scope={sceneScope(scene)}
        functions={sceneFunctions(scene)}
        onSelect={onSelect}
        onChange={() => {}}
        onVariable={() => {}}
        selected={false}
      />,
    ),
    scene,
    onSelect,
  };
}
it("draws two number-line jumps, including the signed negative displacement, with editable selection", () => {
  const { container, scene, onSelect } = draw("number-jumps", -4);
  const arcs = container.querySelectorAll(".pc-number-jump");
  expect(arcs).toHaveLength(2);
  expect(
    [...container.querySelectorAll(".pc-jump-label")].map((n) => n.textContent),
  ).toEqual(["+3", "-4"]);
  expect(arcs[1]!.getAttribute("d")).toContain("Q");
  fireEvent.click(arcs[1]!);
  expect(onSelect).toHaveBeenCalledWith(
    scene.primitives.filter((p) => p.kind === "vector_segment")[1]!.id,
  );
});
it("draws the unit circle with equal horizontal and vertical scale", () => {
  const { container } = draw("unit-circle");
  const circle = container.querySelector("ellipse")!;
  expect(Number(circle.getAttribute("rx"))).toBeCloseTo(
    Number(circle.getAttribute("ry")),
    8,
  );
  expect(container.querySelectorAll("ellipse")).toHaveLength(1);
});
it("labels the dynamic 3-4-5 triangle inside its coordinate plane", () => {
  const { container } = draw("pythagoras");
  const points = container.querySelector("polygon")!.getAttribute("points")!
    .split(" ").map((p) => p.split(",").map(Number));
  const unitX = Math.abs(points[1]![0]! - points[0]![0]!) / 3;
  const unitY = Math.abs(points[2]![1]! - points[0]![1]!) / 4;
  expect(unitX).toBeCloseTo(unitY, 8);
  expect(screen.getByText("5 cm")).toBeInTheDocument();
  expect(screen.getByText("90°")).toBeInTheDocument();
});

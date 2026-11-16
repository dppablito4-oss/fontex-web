import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PrimitiveVisual } from "./PrimitiveVisual";
import { templateScene } from "../../core/primitives/templates";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { createPrimitive, newPrimitiveScene, primitiveNames, parsePrimitiveScene } from "../../core/primitives/schema";
function draw(id: string, value?: number) {
  const scene = templateScene(id);
  if (value !== undefined) {
    scene.variables.find((v) => v.name === "b")!.value = value;
  }
  const p = scene.primitives[0]!;
  const onSelect = vi.fn();
  const onChange = vi.fn();
  return {
    ...render(
      <PrimitiveVisual
        p={p}
        scene={scene}
        scope={sceneScope(scene)}
        functions={sceneFunctions(scene)}
        onSelect={onSelect}
        onChange={onChange}
        onVariable={() => {}}
        selected={false}
      />,
    ),
    scene,
    onSelect,
    onChange,
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

it("zooms with Ctrl + wheel and pans with the hand tool, keeping a valid scene", () => {
  const { scene, onChange } = draw("geometry");
  const plot = screen.getByRole("img", { name: "Compara las figuras" });
  vi.spyOn(plot, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 520, width: 800, height: 520, toJSON: () => ({}),
  });
  fireEvent.wheel(plot, { deltaY: -100, clientX: 400, clientY: 260 });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.wheel(plot, { ctrlKey: true, deltaY: -100, clientX: 400, clientY: 260 });
  expect(onChange).toHaveBeenCalledTimes(1);
  const zoomed = onChange.mock.calls[0]![0] as typeof scene.primitives[number];
  expect(zoomed.kind === "coordinate_canvas" && zoomed.data.autoFit).toBe(false);
  expect(() => parsePrimitiveScene({ ...scene, primitives: scene.primitives.map((p) => p.id === zoomed.id ? zoomed : p) })).not.toThrow();
  const previous = window.PointerEvent;
  Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent });
  Object.defineProperty(plot, "setPointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(plot, "releasePointerCapture", { configurable: true, value: vi.fn() });
  try {
    fireEvent.click(screen.getByRole("button", { name: "Mover vista del plano" }));
    fireEvent.pointerDown(plot, { button: 0, clientX: 400, clientY: 260 });
    fireEvent.pointerMove(plot, { clientX: 480, clientY: 300 });
    fireEvent.pointerUp(plot);
    const panned = onChange.mock.calls.at(-1)![0] as typeof scene.primitives[number];
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(() => parsePrimitiveScene({ ...scene, primitives: scene.primitives.map((p) => p.id === panned.id ? panned : p) })).not.toThrow();
    if (panned.kind === "coordinate_canvas" && zoomed.kind === "coordinate_canvas") {
      expect(Number(panned.data.domainX[0])).toBeLessThan(Number(zoomed.data.domainX[0]));
    }
  } finally {
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: previous });
    vi.restoreAllMocks();
  }
});

it("restores a function plot's reference window after a saved zoom", () => {
  const view = draw("calculus");
  const plane = view.scene.primitives[0]!;
  if (plane.kind !== "coordinate_canvas") throw Error("Missing plane");
  fireEvent.click(screen.getByRole("button", { name: "Acercar plano" }));
  const zoomed = view.onChange.mock.calls[0]![0] as typeof plane;
  const scene = parsePrimitiveScene({ ...view.scene, primitives: view.scene.primitives.map((p) => p.id === zoomed.id ? zoomed : p) });
  view.rerender(<PrimitiveVisual p={zoomed} scene={scene} scope={sceneScope(scene)} functions={sceneFunctions(scene)} onChange={view.onChange} onSelect={view.onSelect} onVariable={() => {}} selected={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Ajustar plano a las figuras" }));
  const restored = view.onChange.mock.calls.at(-1)![0] as typeof plane;
  expect(restored.data.domainX).toEqual(plane.data.domainX);
  expect(restored.data.rangeY).toEqual(plane.data.rangeY);
  expect(restored.data.autoFit).toBe(true);
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
  expect(container.querySelector(".pc-coordinate > svg")!.textContent).toContain("5 cm");
  expect(container.querySelector(".pc-coordinate > svg")!.textContent).toContain("90°");
});

it.each(Object.keys(primitiveNames) as (keyof typeof primitiveNames)[])("renders the validated JSON family %s without a visual error", (kind) => {
  const scene = newPrimitiveScene();
  scene.primitives.push(createPrimitive("coordinate_canvas", scene));
  const p = createPrimitive(kind, scene);
  scene.primitives.push(p);
  const parsed = parsePrimitiveScene(JSON.parse(JSON.stringify(scene)));
  const { container } = render(<PrimitiveVisual p={parsed.primitives[kind === "function_region" ? 0 : 1]!} scene={parsed} scope={sceneScope(parsed)} functions={sceneFunctions(parsed)} onSelect={() => {}} onChange={() => {}} onVariable={() => {}} selected />);
  expect(container.querySelector(".pc-error")).toBeNull();
  expect(container.querySelector("svg, .pc-math, .pc-answer-field, input, button")).not.toBeNull();
});

it.each([[2, 5, 1], [7, 4, 2], [8, 4, 2], [1, 2, 1], [2, 4, 1]])("renders %i/%i as %i real circular units", (numerator, denominator, units) => {
  const scene = newPrimitiveScene();
  const p = createPrimitive("geometric_shape", scene);
  p.data = { ...p.data, shape: "circle_fraction", divisions: denominator, shadedExpr: String(numerator), canvasId: null };
  scene.primitives.push(p);
  const parsed = parsePrimitiveScene(JSON.parse(JSON.stringify(scene)));
  const { container } = render(<PrimitiveVisual p={parsed.primitives[0]!} scene={parsed} scope={sceneScope(parsed)} functions={sceneFunctions(parsed)} onSelect={() => {}} onChange={() => {}} onVariable={() => {}} selected={false} />);
  expect(screen.getAllByRole("img", { name: /fracción circular/ })).toHaveLength(units);
  expect(container.querySelectorAll(".pc-circles svg > g")).toHaveLength(units * denominator);
  expect([...container.querySelectorAll(".pc-circles path")].filter((path) => path.getAttribute("fill") !== "var(--pc-empty)")).toHaveLength(numerator);
});

it("renders time, velocity and displacement in one linked three-column table",()=>{
  const scene=newPrimitiveScene();scene.variables=[{name:"v0",value:4,min:0,max:20,step:.5,unit:"m/s"},{name:"a",value:2,min:-5,max:10,step:.5,unit:"m/s²"},{name:"t",value:5,min:1,max:15,step:1,unit:"s"}];
  const p=createPrimitive("data_chart",scene);p.data.chartType="table_only";
  p.data.headers=["Tiempo","Velocidad","Desplazamiento"];
  p.data.rows=[{label:"T",xExpr:"v0+a*t",valueExpr:"v0*t+0.5*a*t^2"}];scene.primitives.push(p);
  const draw=()=> <PrimitiveVisual p={p} scene={scene} scope={sceneScope(scene)} functions={sceneFunctions(scene)} onChange={()=>{}} onVariable={()=>{}} onSelect={()=>{}} selected={false} readOnly/>;
  const view=render(draw());
  expect(screen.getAllByRole("columnheader").map(c=>c.textContent)).toEqual(["Tiempo","Velocidad","Desplazamiento"]);
  expect(screen.getAllByRole("cell").map(c=>c.textContent)).toEqual(["T","14","45"]);
  scene.variables[1]!.value=-2;view.rerender(draw());
  expect(screen.getAllByRole("cell").map(c=>c.textContent)).toEqual(["T","-6","-5"]);
});

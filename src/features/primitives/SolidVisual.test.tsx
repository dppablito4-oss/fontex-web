import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PrimitiveVisual } from "./PrimitiveVisual";
import {
  createPrimitive,
  newPrimitiveScene,
  type Primitive,
} from "../../core/primitives/schema";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";

it("orbits locally in a shared/practice view without editing the teacher's scene", () => {
  const scene = newPrimitiveScene(), p = createPrimitive("solid_3d", scene);
  p.data.solid = "pyramid";
  scene.primitives.push(p);
  const onChange = vi.fn();
  const props = {
    p,
    scene,
    scope: sceneScope(scene),
    functions: sceneFunctions(scene),
    onChange,
    onSelect: vi.fn(),
    onVariable: vi.fn(),
    selected: false,
  };
  const { container } = render(<PrimitiveVisual {...props} readOnly />);
  const svg = screen.getByRole("img", { name: "Pirámide en 3D" }),
    before = svg.getAttribute("data-camera"),
    shape = container.querySelector("polygon")!.getAttribute("points");
  fireEvent.click(screen.getByRole("button", { name: "Girar a la derecha" }));
  expect(svg.getAttribute("data-camera")).not.toBe(before);
  expect(container.querySelector("polygon")!.getAttribute("points")).not.toBe(
    shape,
  );
  fireEvent.keyDown(
    screen.getByRole("group", { name: "Explorador 3D: Pirámide" }),
    { key: "ArrowUp" },
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(p.data.camera.yaw).toBe(35);
});
it("persists an author's camera and recalculates outputs when a variable changes", () => {
  const scene = newPrimitiveScene(), p = createPrimitive("solid_3d", scene);
  p.data.widthExpr = "a";
  scene.primitives.push(p);
  const onChange = vi.fn<(value: Primitive) => void>(),
    props = {
      p,
      scene,
      scope: sceneScope(scene),
      functions: sceneFunctions(scene),
      onChange,
      onSelect: vi.fn(),
      onVariable: vi.fn(),
      selected: false,
    };
  const view = render(<PrimitiveVisual {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Girar a la derecha" }));
  const changed=onChange.mock.calls[0]?.[0];
  if(changed?.kind!=="solid_3d") throw Error("Se esperaba una cámara de cuerpo 3D.");
  expect(changed.data.camera.yaw).toBe(50);
  expect(screen.getByLabelText("Medidas del cuerpo 3D")).toHaveTextContent(
    "Volumen: 1 cm³",
  );
  scene.variables[0]!.value = 3;
  view.rerender(<PrimitiveVisual {...props} scope={sceneScope(scene)} />);
  expect(screen.getByLabelText("Medidas del cuerpo 3D")).toHaveTextContent(
    "Volumen: 27 cm³",
  );
});

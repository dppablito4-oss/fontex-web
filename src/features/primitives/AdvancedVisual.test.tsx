import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { templates, templateScene } from "../../core/primitives/templates";
import { sceneFunctions, sceneScope } from "../../core/primitives/math";
import { PrimitiveVisual } from "./PrimitiveVisual";
function Example({ id }: { id: string }) {
  const [scene, setScene] = useState(() => templateScene(id));
  return (
    <>
      {scene.primitives.filter((p) =>
        !("canvasId" in p.data && p.data.canvasId)
      ).map((p) => (
        <PrimitiveVisual
          key={p.id}
          p={p}
          scene={scene}
          scope={sceneScope(scene)}
          functions={sceneFunctions(scene)}
          onChange={() => {}}
          onSelect={() => {}}
          selected={false}
          onVariable={(name, value) =>
            setScene({
              ...scene,
              variables: scene.variables.map((v) =>
                v.name === name ? { ...v, value } : v
              ),
            })}
        />
      ))}
    </>
  );
}
it.each(templates.slice(0, 11).map((t) => t.id))(
  "renders the %s composition without a boundary error",
  (id) => {
    const { container } = render(<Example id={id} />);
    expect(container.querySelector(".pc-error")).toBeNull();
    expect(container.textContent).not.toContain("No definido");
  },
);
it("keeps circuit output, truth-table selection and switches in agreement", () => {
  const { container } = render(<Example id="logic-circuit" />);
  expect(container.querySelector('[data-node-id="out"]')).toHaveAttribute(
    "data-state",
    "1",
  );
  fireEvent.click(screen.getByRole("switch", { name: "Proposición r" }));
  expect(container.querySelector('[data-node-id="out"]')).toHaveAttribute(
    "data-state",
    "0",
  );
  fireEvent.click(screen.getByRole("button", { name: "Entrada q" }));
  expect(screen.getByRole("switch", { name: "Proposición q" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(container.querySelector('[data-node-id="out"]')).toHaveAttribute(
    "data-state",
    "1",
  );
  expect(container.querySelectorAll(".pc-truth-active")).toHaveLength(1);
});
it("handles a singular matrix while preserving the forward transformation", () => {
  const { container } = render(<Example id="matrix-transform" />);
  fireEvent.change(screen.getByRole("slider", { name: "Variable a" }), {
    target: { value: "0" },
  });
  expect(screen.getByText(/Matriz singular: no tiene inversa/))
    .toBeInTheDocument();
  expect(container.querySelector(".pc-error")).toBeNull();
  expect(container.querySelectorAll("polygon")).toHaveLength(2);
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { GuidedObject } from "./GuidedObject";
import { TeachingMode } from "./teaching-mode";
import { PropertiesInspector } from "./PropertiesInspector";
import { printableMaterial } from "./export-pdf";
it("revela una división por paso y acepta productos equivalentes en práctica", () => {
  const object = createObject("factorization");
  const view = render(<GuidedObject object={object} />);
  expect(screen.queryByLabelText("Divisiones exactas")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
  expect(within(screen.getByRole("list",{name:"Divisiones exactas"})).getAllByRole("listitem")).toHaveLength(1);
  view.rerender(<TeachingMode.Provider value="practice"><GuidedObject key="practice" object={object} /></TeachingMode.Provider>);
  expect(screen.queryByLabelText("Producto de factores primos")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Respuesta del módulo"),{target:{value:"2^2 × 3^2"}});
  fireEvent.click(screen.getByRole("button",{name:"Comprobar respuesta"}));
  expect(screen.getByRole("status")).toHaveTextContent("equivalente");
});
it("oculta el área en práctica y exporta la representación y la explicación completas", () => {
  const doc = createDocument("blank"); doc.objects.push(createObject("polygon"),createObject("factorization"));
  render(<TeachingMode.Provider value="practice"><GuidedObject object={doc.objects[0]!} /></TeachingMode.Provider>);
  expect(screen.getByRole("img",{name:/Polígono de 4 lados/})).toBeInTheDocument();
  expect(screen.queryByText("Área exacta")).not.toBeInTheDocument();
  const html = printableMaterial(doc,"primary");
  expect(html).toContain("Área exacta");
  expect(html).toContain("2 × 2 × 3 × 3");
  expect(html).toContain("Comprueba el producto");
});
it("el inspector rechaza polígonos cruzados sin cambiar el documento", () => {
  const apply=vi.fn();
  render(<PropertiesInspector object={createObject("polygon")} onApply={apply} />);
  fireEvent.change(screen.getByLabelText("Vértices en orden"),{target:{value:"0,0; 4,4; 0,4; 4,0"}});
  fireEvent.click(screen.getByRole("button",{name:"Aplicar cambios"}));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

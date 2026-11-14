import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { type MathObject } from "../../core/document-schema/document";
import { useStudioDocument } from "./useStudioDocument";
import { saveMaterial } from "./native-document-store";
import { InlineEditingContext } from "./inline-editing-context";
import { ObjectVisual } from "./MathObjectRenderer";
import { printableMaterial } from "./export-pdf";
import { StudioShell } from "./StudioShell";
import { ThemeProvider } from "../theme/ThemeProvider";

function graphObject() {
  const object = createObject("function-graph");
  if (object.type !== "function-graph") throw Error("Wrong type");
  object.data = { ...object.data, source: "sin(x)", angleUnit: "degrees", xMin: 0, xMax: 360, yMin: -1.5, yMax: 1.5, pointXs: [0, 90, 180, 270, 360] };
  return object;
}
function Editor() {
  const store = useStudioDocument("guest"), object = store.document.objects[0]!;
  return <><button onClick={store.undo} disabled={!store.canUndo}>Deshacer</button><InlineEditingContext.Provider value={{ object, onChange: (next: MathObject) => store.update(doc => ({ ...doc, objects: [next] })) }}><ObjectVisual object={object} onChange={() => {}} /></InlineEditingContext.Provider></>;
}

it("renders an actual sine curve and its agreed points and preserves edits, undo and reload", () => {
  const document = { ...createDocument("blank"), objects: [graphObject()] };
  saveMaterial(localStorage, "guest", document);
  const view = render(<Editor />);
  const svg = screen.getByRole("img", { name: /Gráfica de sin\(x\) en grados/ });
  expect(svg.querySelectorAll("path[data-function-curve]")).toHaveLength(1);
  expect(svg.querySelectorAll("circle[data-function-point]")).toHaveLength(5);
  const row = within(screen.getByRole("table", { name: "Puntos calculados de la función" })).getAllByRole("row")[2]!;
  expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["90", "1"]);
  fireEvent.change(screen.getByLabelText("Función de x"), { target: { value: "cos(x)" } });
  expect(screen.getByRole("img", { name: /Gráfica de cos\(x\) en grados/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(screen.getByRole("img", { name: /Gráfica de sin\(x\) en grados/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Mostrar derivada"), { target: { value: "true" } });
  expect(screen.getByRole("columnheader", { name: "f′(x)" })).toBeInTheDocument();
  view.unmount(); render(<Editor />);
  expect(screen.getByLabelText("Mostrar derivada")).toHaveValue("true");
  expect(screen.getByRole("img", { name: /Gráfica de sin\(x\) en grados/ })).toBeInTheDocument();
});

it("exports the actual SVG curve and points to PDF markup without editable fields", () => {
  const html = printableMaterial({ ...createDocument("blank"), objects: [graphObject()] }, "secondary");
  expect(html).toContain('data-function-curve="true"');
  expect(html).toContain('data-function-point="90"');
  expect(html).toContain("grados");
  expect(html).not.toContain("<input");
  expect(html).not.toContain("<select");
});

it("creates and reopens a real sine graph from the free-canvas palette without leaving the lateral assistant", () => {
  const view = render(<ThemeProvider><StudioShell /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Módulos" }));
  fireEvent.click(screen.getByRole("button", { name: "Funciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Añadir gráfica de función" }));
  const fields = { "Función de x": "sin(x)", "Unidad angular": "degrees", "Mínimo de x": "0", "Máximo de x": "360", "Mínimo de y": "-1.5", "Máximo de y": "1.5", "Puntos de x": "0, 90, 180, 270, 360" };
  for (const [label, value] of Object.entries(fields)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  expect(screen.getByRole("img", { name: /Gráfica de sin\(x\) en grados/ }).querySelectorAll("circle[data-function-point]")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Asistente" }));
  expect(screen.getByRole("region", { name: "Fontex Agente" })).toBeInTheDocument();
  view.unmount();
  render(<ThemeProvider><StudioShell /></ThemeProvider>);
  expect(screen.getByRole("img", { name: /Gráfica de sin\(x\) en grados/ })).toBeInTheDocument();
  expect(screen.getByLabelText("Puntos de x")).toHaveValue("0, 90, 180, 270, 360");
});

import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDocument, createObject, objectRegistry } from "../../core/object-registry/registry";
import { validateObject, type ObjectType } from "../../core/document-schema/document";
import { InlineEditingContext } from "./inline-editing-context";
import { ObjectVisual } from "./MathObjectRenderer";
import { CanvasViewport } from "./CanvasViewport";
import { useStudioDocument } from "./useStudioDocument";
import { lastMaterial, saveMaterial } from "./document-store";
import { fieldSpec, editField, inlineFields } from "./inline-fields";
import { TeachingMode } from "./teaching-mode";
import { printableMaterial } from "./export-pdf";

function Editor({ presenting = false, practice = false }: { presenting?: boolean; practice?: boolean }) {
  const store = useStudioDocument("guest");
  return <TeachingMode.Provider value={practice ? "practice" : "learn"}>
    <button onClick={store.undo} disabled={!store.canUndo}>Deshacer</button><button onClick={store.redo} disabled={!store.canRedo}>Rehacer</button>
    <CanvasViewport objects={store.document.objects} selectedId={null} zoom={1} presenting={presenting} onSelect={() => {}} onDelete={id => store.update(doc => ({ ...doc, objects: doc.objects.filter(o => o.id !== id) }))} onChange={object => store.update(doc => ({ ...doc, objects: doc.objects.map(o => o.id === object.id ? object : o) }), true)} onBeginEdit={store.beginEdit} onEndEdit={store.endEdit} onCancelEdit={store.cancelEdit} />
  </TeachingMode.Provider>;
}
function seed(type: ObjectType) {
  const object = createObject(type), doc = { ...createDocument("blank"), objects: [object] };
  saveMaterial(localStorage, "guest", doc);
  return object;
}
const changes: [ObjectType, string, string, unknown][] = [
  ["fraction", "numerator", "3", 3], ["operation", "expression", "1/2 + 1/4", "1/2 + 1/4"],
  ["text", "content", "Una explicación\ncon dos líneas", "Una explicación\ncon dos líneas"],
  ["sequence", "difference", "3", 3], ["collection", "values", "1, 2, 2", [1, 2, 2]],
  ["number-line", "points", "-2, 2", [-2, 2]], ["linear-equation", "d", "4", 4],
  ["geometry", "base", "8", 8], ["polygon", "vertices", "0,0; 5,0; 5,3; 0,3", [{x:0,y:0},{x:5,y:0},{x:5,y:3},{x:0,y:3}]],
  ["factorization", "number", "48", 48], ["percentage", "part", "50", 50],
  ["divisibility", "a", "24", 24], ["angle", "degrees", "120", 120], ["circle", "radius", "5", 5],
  ["statistics", "values", "1, 2, 2", [1, 2, 2]], ["probability", "favorable", "3", 3],
  ["algebra-tiles", "b", "-2", -2], ["powers-roots", "base", "5", 5], ["measurement", "value", "3", 3],
];
describe("Edición directa del lienzo", () => {
  it.each(changes)("edita y recupera %s sin formulario lateral", (type, field, raw, expected) => {
    const object = seed(type);
    const view = render(<Editor />);
    const article = screen.getByRole("article", { name: object.label });
    const input = within(article).getByLabelText(fieldSpec(object, field).label);
    act(() => input.focus()); fireEvent.change(input, { target: { value: raw } });
    expect(lastMaterial(localStorage, "guest")?.objects[0]?.data).toMatchObject({ [field]: expected });
    expect(within(article).getByLabelText(fieldSpec(object, field).label)).toBe(input);
    expect(screen.queryByRole("button", { name: "Aplicar cambios" })).not.toBeInTheDocument();
    act(() => input.blur());
    view.unmount(); render(<Editor />);
    expect(screen.getByLabelText(fieldSpec(object, field).label)).toHaveValue(raw);
  });
  it.each(Object.keys(objectRegistry) as ObjectType[])("ofrece los parámetros de %s y exporta sin editores", type => {
    const object = createObject(type);
    const view = render(<InlineEditingContext.Provider value={{ object, onChange: () => {} }}><ObjectVisual object={object} onChange={() => {}} /></InlineEditingContext.Provider>);
    for (const field of Object.keys(inlineFields[type])) {
      if (type === "probability" && field === "outcomes") continue; // Fixed by coin/dice; editable for a spinner.
      expect(screen.getByLabelText(fieldSpec(object, field).label)).toBeInTheDocument();
    }
    view.unmount();
    const markup = printableMaterial({ ...createDocument("blank"), objects: [object] }, "secondary");
    expect(markup).not.toMatch(/<(input|textarea|select|foreignObject)\b/);
  });
  it("recalcula las piezas, agrupa la escritura, cancela y permite deshacer/rehacer", () => {
    seed("fraction"); render(<Editor />);
    const input = screen.getByLabelText("Denominador");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "12" } });
    expect(input).toHaveFocus();
    expect(screen.getByRole("img", { name: "2 de 12 partes por unidad" }).querySelectorAll("rect")).toHaveLength(12);
    act(() => input.blur()); fireEvent.click(screen.getByText("Deshacer"));
    expect(screen.getByRole("img", { name: "2 de 3 partes por unidad" })).toBeInTheDocument();
    expect(screen.getByText("Deshacer")).toBeDisabled();
    fireEvent.click(screen.getByText("Rehacer"));
    expect(screen.getByLabelText("Denominador")).toHaveValue("12");
    act(() => input.focus()); fireEvent.change(input, { target: { value: "6" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByRole("img", { name: "2 de 12 partes por unidad" })).toBeInTheDocument();
    act(() => input.focus()); fireEvent.change(input, { target: { value: "0" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("1 a 24");
    fireEvent.keyDown(input, { key: "Backspace" }); fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(lastMaterial(localStorage, "guest")?.objects).toHaveLength(1);
    expect(screen.getByRole("img", { name: "2 de 12 partes por unidad" })).toBeInTheDocument();
    act(() => input.blur()); expect(input).toHaveValue("12");
  });
  it.each([{ presenting: true }, { practice: true }])("mantiene los datos de solo lectura en %j", props => {
    seed("fraction"); render(<Editor {...props} />);
    expect(screen.queryByLabelText("Numerador")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre del objeto")).not.toBeInTheDocument();
  });
  it("normaliza parámetros dependientes sin crear estados incompatibles", () => {
    const dice = createObject("probability");
    const coin = editField(dice, "experiment", "coin");
    expect(coin.data).toMatchObject({ outcomes: 2, favorable: 2 });
    const spinner = editField(coin, "experiment", "spinner");
    expect(editField(spinner, "outcomes", "3").data).toMatchObject({ outcomes: 3 });
    const measurement = editField(createObject("measurement"), "from", "L");
    expect(measurement.data).toMatchObject({ from: "L", to: "L" });
    const root = editField(createObject("powers-roots"), "task", "root");
    expect(editField(root, "radicand", "25").data).toMatchObject({ base: 5 });
    expect(() => editField(root, "radicand", "26")).toThrow(/Raíz exacta/);
    expect(validateObject(root)).toBe(true);
    expect(() => editField(createObject("collection"), "values", "1,,2")).toThrow();
    expect(() => editField(createObject("polygon"), "vertices", "0,0; 5,5; 0,5; 5,0")).toThrow();
  });
  it("conserva el historial previo al cancelar una edición y termina grupos al deshacer", () => {
    seed("fraction");
    const { result } = renderHook(() => useStudioDocument("guest"));
    const original = result.current.document;
    act(() => { result.current.update(doc => ({ ...doc, title: "Título nuevo" })); result.current.beginEdit(); result.current.update(doc => ({ ...doc, title: "Borrador" }), true); result.current.cancelEdit(); });
    expect(result.current.document.title).toBe("Título nuevo");
    act(() => result.current.undo()); expect(result.current.document).toEqual(original);
    act(() => result.current.redo()); expect(result.current.document.title).toBe("Título nuevo");
    act(() => { result.current.beginEdit(); result.current.update(doc => ({ ...doc, title: "A" }), true); result.current.update(doc => ({ ...doc, title: "AB" }), true); result.current.undo(); });
    expect(result.current.document.title).toBe("Título nuevo");
    act(() => result.current.redo()); expect(result.current.document.title).toBe("AB");
  });
  it("no cancela cambios externos recibidos durante una edición", () => {
    seed("fraction");
    const { result } = renderHook(() => useStudioDocument("guest"));
    act(() => {
      result.current.beginEdit();
      result.current.update(doc => ({ ...doc, title: "Primer cambio" }), true);
      // A response from the assistant is a separate undo step.
      result.current.execute({ documentId: result.current.document.id, actions: [{ kind: "create", object: createObject("circle") }] });
      result.current.update(doc => ({ ...doc, title: "Segundo cambio" }), true);
      result.current.cancelEdit();
    });
    expect(result.current.document.title).toBe("Primer cambio");
    expect(result.current.document.objects).toHaveLength(2);
    expect(lastMaterial(localStorage, "guest")).toEqual(result.current.document);
    act(() => result.current.undo());
    expect(result.current.document.objects).toHaveLength(1);
  });

});

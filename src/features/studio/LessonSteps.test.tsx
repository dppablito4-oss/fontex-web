import { expect, it } from "vitest";
import { boardHeight, fitObject, parseDocument } from "../../core/document-schema/document";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { lessonSteps } from "./lesson-steps";
import { printableMaterial, printablePage } from "./export-pdf";
import { geometryArea } from "../../core/math-engine/geometry";

it("crece verticalmente sin apilar los objetos al final del antiguo lienzo", () => {
  const doc = createDocument("blank");
  doc.objects = [fitObject({ ...createObject("fraction"), y: 25000 })];
  expect(parseDocument(doc).objects[0]!.y).toBe(25000);
  expect(boardHeight(doc.objects)).toBeGreaterThan(25340);
});
it("justifica equivalencias, operación y simplificación en pasos separados", () => {
  const steps = lessonSteps(createObject("operation"), "primary");
  expect(steps.length).toBe(7);
  expect(steps[2]![1]).toContain("2/3 × 2/2 = 4/6");
  expect(steps[4]![1]).toContain("4 + 3 = 7");
  expect(steps.at(-1)![1]).toContain("7/6");
});
it("adapta el vocabulario de primaria y secundaria sin cambiar la matemática", () => {
  const object = createObject("operation");
  expect(lessonSteps(object, "primary")[1]![1]).toContain("piezas iguales");
  expect(lessonSteps(object, "secondary")[1]![1]).toContain("m.c.m.");
});
it("exporta contenido completo fuera del área visible, con pasos y texto escapado", () => {
  const doc = createDocument("blank"); doc.title = '<script>alert("x")</script>';
  doc.objects = [{ ...createObject("operation"), y: 20000 }, { ...createObject("geometry"), y: 30000 }];
  const html = printableMaterial(doc, "primary");
  expect(html).toContain("Transforma la primera fracción");
  expect(html).toContain("altura perpendicular 4");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("20000px");
  expect(html).toContain('alt="Logo de Fontex"');
  expect(html).not.toContain("Material de aprendizaje");
  expect(html).not.toContain("<details");
  const page = printablePage(doc, "primary", "");
  expect(page).toContain("&lt;script&gt;");
  expect(page).not.toContain("<script>");
});
it("calcula exactamente áreas triangulares con media unidad", () => {
  expect(geometryArea({ figure: "triangle", base: 3, height: 3 })).toEqual({ n: 9, d: 2 });
  expect(lessonSteps({ ...createObject("geometry"), type: "geometry", data: { figure: "triangle", base: 3, height: 3 } }, "primary")[2]![1]).toContain("4.5");
});

import { describe, expect, it } from "vitest";
import { regularPolygonInfo, measureText } from "./regular-polygons";
import { createDocument, createObject } from "../object-registry/registry";
import { parseDocument, validateObject } from "../document-schema/document";
import { executeActions } from "../agent/actions";
import { learningLesson } from "./learning-modules";

describe("Figuras regulares con medidas", () => {
  it("calcula medidas coherentes para todos los lados y longitudes admitidos", () => {
    for (let sides = 3; sides <= 12; sides++) for (const sideLength of [.01, .25, 1, 2.5, 1000]) {
      const data = { sides, sideLength, unit: "cm" as const }, a = regularPolygonInfo(data);
      expect(a.perimeter).toBeCloseTo(sides * sideLength, 10);
      expect(a.radius * 2 * Math.sin(Math.PI / sides)).toBeCloseTo(sideLength, 10);
      expect(a.area).toBeCloseTo(a.perimeter * a.apothem / 2, 8);
      expect(a.areaExact).toBe(sides === 4);
    }
  });
  it("conserva la exactitud de un cuadrado decimal y clasifica las demás áreas", () => {
    const square = regularPolygonInfo({ sides: 4, sideLength: 1.25, unit: "m" });
    expect(square.area).toBe(1.5625);
    expect(measureText(square.area, square.areaExact)).toBe("1.5625");
    expect(regularPolygonInfo({ sides: 3, sideLength: 2, unit: "cm" }).area).toBeCloseTo(Math.sqrt(3));
    expect(regularPolygonInfo({ sides: 6, sideLength: 2, unit: "cm" }).area).toBeCloseTo(6 * Math.sqrt(3));
  });
  it("rechaza datos físicamente inválidos sin redondear medidas para hacerlas caber", () => {
    const data = { sides: 6, sideLength: 4, unit: "cm" as const };
    for (const patch of [{sides:2},{sides:13},{sides:3.5},{sideLength:0},{sideLength:1.234},{sideLength:Infinity},{unit:"cm2"}]) expect(() => regularPolygonInfo({...data,...patch} as typeof data)).toThrow();
  });
  it("admite objetos nuevos, datos anteriores sin unidad y lotes compatibles", () => {
    const doc = createDocument("blank");
    const regular = createObject("regular-polygon");
    expect(executeActions(doc, {documentId:doc.id,actions:[{kind:"create",object:regular}]}).objects[0]).toEqual(regular);
    for (const type of ["geometry", "polygon", "circle"] as const) {
      const old = createObject(type);
      expect(validateObject(old)).toBe(true);
      const measured = {...old,data:{...old.data,unit:"m"}};
      const updated = executeActions({...doc,objects:[old]}, {documentId:doc.id,actions:[{kind:"update",object:measured}]});
      expect(parseDocument(updated).objects[0]?.data).toMatchObject({unit:"m"});
    }
  });
  it("practica un perímetro exacto y reserva las fórmulas de apotema para niveles avanzados", () => {
    const data = { sides: 5, sideLength: 1.25, unit: "cm" as const };
    expect(learningLesson({type:"regular-polygon",data}).answer).toEqual({n:25,d:4});
    expect(learningLesson({type:"regular-polygon",data},"initial").steps.map(s=>s[1]).join(" ")).not.toContain("tan(");
    expect(learningLesson({type:"regular-polygon",data},"secondary").steps.map(s=>s[1]).join(" ")).toContain("tan(");
  });
});

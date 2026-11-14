import { expect, it } from "vitest";
import { BOARD, parseDocument } from "../../core/document-schema/document";
import {
  createDocument,
  createObject,
} from "../../core/object-registry/registry";
import { fitContentHeights, organizeObjects, resizeObject } from "./object-layout";

it("limita el tamaño sin mover el ancla ni cambiar los datos matemáticos", () => {
  const object = { ...createObject("fraction"), x: 1000, y: 700 };
  const next = resizeObject(object, 2000, 2000);
  expect(next).toMatchObject({
    x: 1000,
    y: 700,
    width: BOARD.width - 1000,
    height: 2000,
    data: object.data,
  });
  expect(
    parseDocument({ ...createDocument("blank"), objects: [next] }).objects[0],
  ).toEqual(next);
  expect(object.width).toBe(440);
});

it("respeta los mínimos y descarta coordenadas de tamaño no finitas", () => {
  const object = createObject("text");
  expect(resizeObject(object, -100, 0)).toMatchObject({
    width: 240,
    height: 160,
  });
  expect(resizeObject(object, NaN, 300)).toBe(object);
});

it("repairs an inflated graph and keeps following text close as content grows and shrinks", () => {
  const graph = { ...createObject("function-graph"), x: 60, y: 50, width: 1480, height: 100000 };
  const text = { ...createObject("text"), x: 60, y: 100090, width: 1100, height: 360 };
  const original = [graph, text];
  const repaired = fitContentHeights(original, { [graph.id]: 1400, [text.id]: 200 });
  expect(repaired[0]).toMatchObject({ height: 1400, y: 50 });
  expect(repaired[1]).toMatchObject({ height: 200, y: 1490 });
  const grown = fitContentHeights(repaired, { [graph.id]: 1800 });
  expect(grown[1]!.y).toBe(1890);
  expect(fitContentHeights(grown, { [graph.id]: 1400 })).toEqual(repaired);
  expect(fitContentHeights(repaired, { [graph.id]: 1400, [text.id]: 200 })).toBe(repaired);
  expect(original[0]!.height).toBe(100000);
});

it("preserves manual sizes through JSON, does not move another column and compacts the existing content on organize", () => {
  const first = { ...createObject("text"), x: 60, y: 50, width: 500, height: 1000 };
  const other = { ...createObject("text"), x: 800, y: 1200, width: 500, height: 500 };
  const manual = resizeObject(first, 500, 800);
  const doc = parseDocument({ ...createDocument("blank"), objects: [manual] });
  expect(doc.objects[0]!.autoHeight).toBe(false);
  expect(fitContentHeights(doc.objects, { [manual.id]: 200 })).toBe(doc.objects);
  expect(fitContentHeights([first, other], { [first.id]: 200 })[1]).toEqual(other);
  const organized = organizeObjects([first, { ...other, y: 90000 }]);
  expect(organized[1]!.y).toBe(organized[0]!.y + organized[0]!.height + 40);
  expect(organized[0]!.autoHeight).toBe(true);
});

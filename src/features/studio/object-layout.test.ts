import { expect, it } from "vitest";
import { BOARD, parseDocument } from "../../core/document-schema/document";
import {
  createDocument,
  createObject,
} from "../../core/object-registry/registry";
import { resizeObject } from "./object-layout";

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

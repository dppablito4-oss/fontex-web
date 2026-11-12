import { expect, it } from "vitest";
import { analyzeFactors, analyzePolygon, factorAnswer } from "./adapted-modules";
import { isPrime } from "../vendor/mathigon";
import { createDocument, createObject } from "../object-registry/registry";
import { parseDocument } from "../document-schema/document";
import { executeActions, readStudioContext } from "../agent/actions";
import { parseAgentReply } from "../agent/protocol";
import { practiceReply } from "../agent/pedagogy";
it("reconstruye exactamente cada entero admitido con factores primos ordenados", () => {
  for (let n = 2; n <= 360; n++) {
    const { factors, divisions } = analyzeFactors(n);
    expect(factors.every(isPrime)).toBe(true);
    expect(factors.reduce((p, f) => p * f, 1)).toBe(n);
    expect(divisions.at(-1)!.quotient).toBe(1);
    expect(factorAnswer(factors.join("*"), factors)).toBe(true);
  }
});
it.each([0, 1, -2, 2.5, 361, Infinity, NaN])("rechaza un entero fuera del dominio: %s", n => expect(() => analyzeFactors(n)).toThrow());
it("admite orden libre, potencias y superíndices pero exige factores primos", () => {
  expect(factorAnswer("3 * 2^2", [2, 2, 3])).toBe(true);
  expect(factorAnswer("2² × 3", [2, 2, 3])).toBe(true);
  expect(factorAnswer("4 × 3", [2, 2, 3])).toBe(false);
  expect(factorAnswer("2^99", [2])).toBeNull();
  expect(factorAnswer("alert(1)", [2])).toBeNull();
});
it("calcula áreas exactas, medias unidades y polígonos cóncavos en ambas orientaciones", () => {
  const triangle = [{x:0,y:0},{x:3,y:0},{x:0,y:3}];
  expect(analyzePolygon(triangle).areaFraction).toEqual({n:9,d:2});
  expect(analyzePolygon([...triangle].reverse()).area).toBe(4.5);
  const concave = [{x:0,y:0},{x:4,y:0},{x:4,y:1},{x:1,y:1},{x:1,y:4},{x:0,y:4}];
  expect(analyzePolygon(concave)).toMatchObject({area:7,perimeter:16,sides:6});
});
it.each([
  [{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}],
  [{x:0,y:0},{x:2,y:0},{x:1,y:0},{x:0,y:2}],
  [{x:0,y:0},{x:1,y:0},{x:2,y:0}],
  [{x:0,y:0},{x:0,y:0},{x:1,y:2}],
  [{x:0,y:0},{x:21,y:0},{x:0,y:2}],
].map(vertices => ({ vertices })))("rechaza cruces, solapamientos, degeneración y coordenadas inválidas", ({ vertices }) => expect(() => analyzePolygon(vertices)).toThrow());
it.each(["polygon", "factorization"] as const)("integra %s en el protocolo, historia, guardado y contexto matemático", type => {
  const doc = createDocument("blank"), object = createObject(type);
  const batch = { documentId: doc.id, actions: [{ kind: "create" as const, object }] };
  const reply = parseAgentReply({message:"Material listo",batch,verification:[]},doc);
  const next = executeActions(doc, reply.batch, doc);
  expect(parseDocument(JSON.parse(JSON.stringify(next)))).toEqual(next);
  expect(doc.objects).toHaveLength(0);
  expect(readStudioContext(next).mathematics[0]).toHaveProperty(type === "polygon" ? "polygon" : "factorization");
});
it("la práctica de factores no filtra la solución en la primera pista", () => {
  const doc = createDocument("blank"), object = createObject("factorization"); doc.objects.push(object);
  const request = {document:doc,selectedId:object.id,mode:"practice" as const,level:"primary" as const,question:"Descompón",attempt:"",hintLevel:0};
  expect(practiceReply(request).message).not.toContain("2 × 2 × 3 × 3");
  expect(practiceReply({...request,hintLevel:1}).message).not.toContain("2 × 2 × 3 × 3");
  expect(practiceReply({...request,hintLevel:2}).message).toContain("2 × 2 × 3 × 3");
  expect(practiceReply({...request,attempt:"3^2 * 2^2"}).message).toContain("equivalente");
});

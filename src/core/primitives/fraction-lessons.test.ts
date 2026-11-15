import { expect, it } from "vitest";
import { createPrimitive, newPrimitiveScene, parsePrimitiveScene } from "./schema";
import { fractionLessons } from "./fraction-lessons";
import { organizePrimitiveScene } from "./layout";

function lesson() {
  const scene = newPrimitiveScene("Suma de fracciones");
  const text = createPrimitive("math_block",scene);
  text.data.markdownContent = String.raw`## Suma
$$\frac{2}{7}+\frac{3}{7}=\frac{2+3}{7}=\frac{5}{7}$$`;
  text.y = 1664;
  scene.primitives.push(text);
  const result = createPrimitive("geometric_shape",scene);
  result.data.shape = "circle_fraction"; result.data.canvasId = null;
  result.data.divisions = 7; result.data.shadedExpr = "5"; result.y=24;
  scene.primitives.push(result);
  return scene;
}
it("keeps an explanation and its circular models together despite a legacy figures-first layout", () => {
  const scene = lesson(), before = structuredClone(scene);
  const group = fractionLessons(scene)[0]!;
  expect(group.texts[0]!.kind).toBe("math_block");
  expect(group.equation?.terms.map(t=>[t.primitive.data.shadedExpr,t.primitive.data.divisions])).toEqual([["2",7],["3",7],["5",7]]);
  expect(group.equation?.terms.map(t=>t.generated)).toEqual([true,true,false]);
  expect(scene).toEqual(before);
  const arranged = organizePrimitiveScene(scene);
  expect(arranged.primitives[0]!.y).toBeLessThan(arranged.primitives[1]!.y);
  expect(parsePrimitiveScene(arranged).primitives).toHaveLength(2);
});
it("uses existing operand models and preserves the original objects", () => {
  const scene=lesson();
  for(const n of [2,3]) {
    const p=createPrimitive("geometric_shape",scene);
    p.data={...p.data,shape:"circle_fraction",canvasId:null,divisions:7,shadedExpr:String(n)};
    scene.primitives.push(p);
  }
  const equation=fractionLessons(scene)[0]!.equation!;
  expect(equation.terms.every(t=>!t.generated)).toBe(true);
  const arranged=organizePrimitiveScene(scene);
  const figures=arranged.primitives.filter(p=>p.kind==="geometric_shape");
  expect(new Set(figures.map(p=>p.y)).size).toBe(1);
  expect(new Set(figures.map(p=>p.x)).size).toBe(3);
});
it("does not fabricate an operation from an incorrect equation or an unrelated drawing", () => {
  const scene=lesson(),text=scene.primitives[0]!;
  if(text.kind!=="math_block") throw Error("text");
  text.data.markdownContent=String.raw`$$\frac{2}{7}+\frac{3}{7}=\frac{6}{7}$$`;
  expect(fractionLessons(scene)[0]!.equation).toBeNull();
});

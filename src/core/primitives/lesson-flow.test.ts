import { expect, it } from "vitest";
import { createPrimitive, newPrimitiveScene, parsePrimitiveScene } from "./schema";
import { fractionLessons } from "./fraction-lessons";
import { lessonSequence } from "./lesson-flow";
import { fitPrimitiveHeight, organizePrimitiveScene, plotCompanions, workspaceRoots } from "./layout";
import { templateScene } from "./templates";

it("keeps successive explanations above their models instead of hiding them in definitions", () => {
  const scene = newPrimitiveScene();
  const plane = createPrimitive("coordinate_canvas", scene);
  const intro = createPrimitive("math_block", scene), next = createPrimitive("math_block", scene);
  next.presentationStep = 2;
  scene.primitives.push(plane, intro, next);
  const side = createPrimitive("vector_segment", scene);
  side.data.canvasId = plane.id; side.presentationStep = 2;
  scene.primitives.push(side);
  expect(plotCompanions(scene, plane.id)).toEqual([]);
  expect(workspaceRoots(scene).map(p => p.id)).toEqual([plane.id, intro.id, next.id]);
  expect(lessonSequence(scene).map(p => p.id)).toEqual([intro.id, plane.id, next.id]);
  const arranged = organizePrimitiveScene(scene);
  expect(arranged.primitives.find(p => p.id === intro.id)!.y).toBeLessThan(arranged.primitives[0]!.y);
  expect(arranged.primitives.find(p => p.id === side.id)).toEqual(side);
});

it("retains embedded tools for a single-stage exploration", () => {
  const scene = newPrimitiveScene();
  const plane = createPrimitive("coordinate_canvas", scene);
  scene.primitives.push(plane, createPrimitive("math_block", scene), createPrimitive("control_slider", scene));
  expect(plotCompanions(scene, plane.id).some(p => p.kind === "math_block")).toBe(true);
  expect(plotCompanions(scene, plane.id).some(p => p.kind === "control_slider")).toBe(true);
});

it("puts the operation's models before its conclusion in old texts-first scenes", () => {
  const scene = newPrimitiveScene();
  const intro = createPrimitive("math_block", scene), conclusion = createPrimitive("math_block", scene);
  intro.data.markdownContent = String.raw`Sumamos: $\frac{2}{6}+\frac{1}{6}=\frac{3}{6}$.`;
  conclusion.data.markdownContent = "Reunimos los tres enteros y la media unidad que acabamos de obtener.";
  scene.primitives.push(intro, conclusion);
  for (const n of [2,1,3]) {
    const p = createPrimitive("geometric_shape", scene);
    p.data = { ...p.data, shape: "circle_fraction", divisions: 6, shadedExpr: String(n) };
    scene.primitives.push(p);
  }
  const before = structuredClone(scene), sequence = lessonSequence(scene);
  expect(sequence.map(item => item.kind)).toEqual(["fraction", "primitive"]);
  expect(fractionLessons(scene)[0]?.texts.map(p => p.id)).toEqual([intro.id]);
  expect(sequence[1]?.id).toBe(conclusion.id);
  const arranged = organizePrimitiveScene(scene);
  const figures = arranged.primitives.filter(p => p.kind === "geometric_shape");
  const start = arranged.primitives.find(p => p.id === intro.id)!, end = arranged.primitives.find(p => p.id === conclusion.id)!;
  expect(Math.min(...figures.map(p => p.y))).toBeGreaterThanOrEqual(start.y + start.height);
  expect(end.y).toBeGreaterThanOrEqual(Math.max(...figures.map(p => p.y + p.height)));
  expect(scene).toEqual(before);
  expect(parsePrimitiveScene(arranged).primitives.map(p => p.id)).toEqual(scene.primitives.map(p => p.id));
});

it("pairs multiple examples within the same presentation step with their own models", () => {
  const scene = newPrimitiveScene();
  for (const [a,b,den] of [[1,2,4],[2,3,7]] as const) {
    const text = createPrimitive("math_block", scene);
    text.data.markdownContent = `$$\\frac{${a}}{${den}}+\\frac{${b}}{${den}}=\\frac{${a+b}}{${den}}$$`;
    scene.primitives.push(text);
  }
  for (const [nums, den] of [[[1,2,3],4],[[2,3,5],7]] as const) {
    for (const n of nums) {
      const p = createPrimitive("geometric_shape", scene);
      p.data = { ...p.data, shape: "circle_fraction", divisions: den, shadedExpr: String(n) };
      scene.primitives.push(p);
    }
  }
  const lessons = fractionLessons(scene);
  expect(lessons).toHaveLength(2);
  expect(lessons.map(l => l.figures.map(p => p.data.divisions))).toEqual([[4,4,4],[7,7,7]]);
  const arranged = organizePrimitiveScene(scene);
  const firstDrawings = arranged.primitives.filter(p => lessons[0]!.figures.some(f => f.id === p.id));
  expect(arranged.primitives[1]!.y).toBeGreaterThan(Math.max(...firstDrawings.map(p => p.y+p.height)));
});

it("interleaves explanations and non-fraction pictograms in presentation order", () => {
  const scene = newPrimitiveScene();
  const picture2 = createPrimitive("data_chart", scene), text2 = createPrimitive("math_block", scene);
  const picture1 = createPrimitive("stamp_grid", scene), text1 = createPrimitive("math_block", scene);
  picture2.presentationStep = text2.presentationStep = 2;
  scene.primitives.push(picture2, text2, picture1, text1);
  const expected = [text1.id, picture1.id, text2.id, picture2.id];
  expect(lessonSequence(scene).map(item => item.id)).toEqual(expected);
  expect([...organizePrimitiveScene(scene).primitives].sort((a,b) => a.y-b.y).map(p => p.id)).toEqual(expected);
});

it("keeps repeated source blocks in order without moving locked content", () => {
  const scene = newPrimitiveScene();
  for (const kind of ["math_block", "stamp_grid", "math_block", "data_chart"] as const) scene.primitives.push(createPrimitive(kind, scene));
  scene.primitives[1]!.locked = true;
  const locked = structuredClone(scene.primitives[1]);
  expect(lessonSequence(scene).map(item => item.id)).toEqual(scene.primitives.map(p => p.id));
  expect(organizePrimitiveScene(scene).primitives[1]).toEqual(locked);
});

it("introduces the sum template, shows its models, then explains the operation", () => {
  const scene = templateScene("sum");
  const sequence = lessonSequence(scene);
  expect(sequence.map(item => item.step)).toEqual([1,1,1,2,3]);
  expect(fractionLessons(scene).map(l => l.figures.length)).toEqual([2,3]);
  expect(fractionLessons(scene)[1]?.equation?.terms.every(t => !t.generated)).toBe(true);
  expect(parsePrimitiveScene(scene)).toEqual(scene);
});

it("keeps the next explanation below the whole row when its three models shrink", () => {
  let scene = templateScene("sum");
  const row = fractionLessons(scene)[1]!.figures;
  const end = scene.primitives.find(p => p.kind === "math_block" && p.presentationStep === 3)!;
  const before = end.y;
  for (const p of row) scene = fitPrimitiveHeight(scene, p.id, 160);
  expect(scene.primitives.find(p => p.id === end.id)?.y).toBe(before-60);
  expect(scene.primitives.find(p => p.id === end.id)!.y).toBeGreaterThan(Math.max(...row.map(p => p.y+160)));
});

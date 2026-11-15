import { expect, it } from "vitest";
import { compile, scalar } from "./math";
import { curvePoint } from "./curves";
import { createPrimitive, newPrimitiveScene } from "./schema";
it("supports rad/deg consistently in the scalar evaluator, plot parser and derivatives", () => {
  expect(scalar("rad(180)",{})).toBeCloseTo(Math.PI,12);
  expect(compile("rad(x)",{}).value(180)).toBeCloseTo(Math.PI,12);
  expect(compile("rad(x)",{}).slope(180)).toBeCloseTo(Math.PI/180,12);
  expect(compile("deg(x)",{}).value(Math.PI)).toBeCloseTo(180,10);
  expect(compile("deg(x)",{}).slope(1)).toBeCloseTo(180/Math.PI,10);
});
it("keeps degree-mode curves equivalent to explicit radians, without double conversion", () => {
  const degrees=compile("sin(x)",{},"deg"), radians=compile("sin(rad(x))",{},"rad"), explicit=compile("sin(rad(x))",{},"deg");
  for(const x of [0,30,45,60,90,180,270,360]) {
    expect(degrees.value(x)).toBeCloseTo(radians.value(x),12);
    expect(explicit.value(x)).toBeCloseTo(radians.value(x),12);
    expect(degrees.slope(x)).toBeCloseTo(radians.slope(x),12);
  }
  expect(compile("cos(2*rad(x))",{},"deg").value(45)).toBeCloseTo(0,12);
});
it("handles parametric and polar problems with degree parameters and explicit conversions", () => {
  const scene=newPrimitiveScene(), p=createPrimitive("function_region",scene);
  p.data.curveMode="parametric";p.data.xExpr="cos(rad(t))";p.data.yExpr="sin(rad(t))";p.data.angleUnit="deg";
  expect(curvePoint(p,90,{}).x).toBeCloseTo(0,12);expect(curvePoint(p,90,{}).y).toBeCloseTo(1,12);
  p.data.curveMode="polar";p.data.rExpr="2*cos(rad(theta))";
  expect(curvePoint(p,60,{}).x).toBeCloseTo(.5,12);
  expect(curvePoint(p,60,{}).y).toBeCloseTo(Math.sqrt(3)/2,12);
});

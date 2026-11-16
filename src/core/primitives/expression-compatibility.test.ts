import { expect, it } from "vitest";
import { compile, integrate, polygonMetrics, scalar, sceneScope } from "./math";
import { createPrimitive, newPrimitiveScene, parsePrimitiveScene } from "./schema";
import { shapeVertices } from "./viewport";

it.each([
  ["floor(x)", -1.2, -2], ["ceil(x)", -1.2, -1], ["abs(x)", -3, 3],
  ["round(x,2)", 1.234, 1.23], ["min(x,3,-2)", 4, -2],
  ["max(x,3,-2)", 4, 4], ["atan2(x,1)", 1, Math.PI / 4],
  ["gcd(x,12)", 8, 4], ["lcm(x,12)", 8, 24],
] as const)("evaluates %s equally in curves and scalar fields", (source, x, expected) => {
  expect(compile(source, {}).value(x)).toBeCloseTo(expected);
  expect(scalar(source, { x })).toBeCloseTo(expected);
});

it("composes helpers with trig functions, parameter changes and angle conversions", () => {
  expect(compile("floor(R*sen(rad(θ)))", { R: 5, theta: 30 }).value(0)).toBe(2);
  expect(compile("max(0,min(sin(x),cos(x)))", {}).value(Math.PI / 4)).toBeCloseTo(Math.SQRT1_2);
  expect(compile("max(sin(x),cos(x))", {}, "deg").value(30)).toBeCloseTo(Math.sqrt(3) / 2);
  expect(compile("floor(x)", {}).slope(1.2)).toBeNaN();
  expect(() => compile("floor(1,2)", {})).toThrow(/argumentos/);
  expect(() => compile("globalThis.fetch(x)", {})).toThrow();
  expect(() => compile("missing+x", {})).toThrow(/missing/);
  const area=integrate(compile("max(0,min(sin(x),cos(x)))", {}).value, 0, Math.PI / 2);
  if(area.status!=="finite") throw Error("La integral debe converger.");
  expect(area.value).toBeCloseTo(2-Math.sqrt(2),5);
});

it("keeps one expression language across all eleven primitive kinds", () => {
  const scene = newPrimitiveScene();
  const plane = createPrimitive("coordinate_canvas", scene);scene.primitives.push(plane);
  const curve = createPrimitive("function_region", scene);curve.data.canvasId=plane.id;curve.data.expression="floor(x)+max(0,sin(x))";curve.data.showArea=false;scene.primitives.push(curve);
  const vector = createPrimitive("vector_segment", scene);vector.data.canvasId=plane.id;vector.data.end=["floor(a)","ceil(a)"];scene.primitives.push(vector);
  const stamps = createPrimitive("stamp_grid",scene);stamps.data.activeCountExpr="floor(abs(a))";scene.primitives.push(stamps);
  const text = createPrimitive("math_block",scene);text.data.markdownContent="Valor: {{floor(a)}}";scene.primitives.push(text);
  const control=createPrimitive("control_slider",scene);scene.primitives.push(control);
  const shape=createPrimitive("geometric_shape",scene);shape.data.sideExpr="max(1,a)";scene.primitives.push(shape);
  const chart=createPrimitive("data_chart",scene);chart.data.chartType="line";chart.data.rows=[{label:"Uno",xExpr:"1",valueExpr:"floor(a)"}];scene.primitives.push(chart);
  const nodes=createPrimitive("node_graph",scene);nodes.data.nodes[0]!.formula="$q={{floor(a)}}$";scene.primitives.push(nodes);
  scene.primitives.push(createPrimitive("answer_field",scene),createPrimitive("annotation_stroke",scene));
  expect(new Set(parsePrimitiveScene(scene).primitives.map(p=>p.kind)).size).toBe(11);
});

it("changes regular polygon sides and rotation without replacing its vertices or scene", () => {
  const scene=newPrimitiveScene();scene.variables=[{name:"n",value:3,min:3,max:12,step:1,unit:""},{name:"R",value:2,min:2,max:8,step:.5,unit:""},{name:"theta",value:0,min:0,max:360,step:5,unit:"°"}];
  const shape=createPrimitive("geometric_shape",scene);shape.data.regular=true;shape.data.sidesExpr="n";shape.data.rotationExpr="theta";shape.data.sideExpr="2*R*sin(pi/n)";scene.primitives.push(shape);
  for(const n of [3,6,12]) for(const R of [2,8]) for(const theta of [0,90,360]) {
    scene.variables.forEach(v=>{v.value=({n,R,theta})[v.name as "n"|"R"|"theta"];});
    const valid=parsePrimitiveScene(scene),scope=sceneScope(valid),vertices=shapeVertices(shape,scope);
    expect(vertices).toHaveLength(n);
    expect(vertices[0]![0]).toBeCloseTo(R*Math.cos(theta*Math.PI/180));
    expect(vertices[0]![1]).toBeCloseTo(R*Math.sin(theta*Math.PI/180));
    expect(polygonMetrics(vertices).area).toBeCloseTo(n*R**2*Math.sin(2*Math.PI/n)/2);
  }
  shape.data.sidesExpr="2.5";expect(()=>parsePrimitiveScene(scene)).toThrow(/lados enteros/);
});

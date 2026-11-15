import { expect, it } from "vitest";
import { createPrimitive, newPrimitiveScene, parsePrimitiveScene, type PrimitiveKind } from "./schema";
import { applyPracticeValue, practiceAttempt, practiceFields } from "./practice";
import { templateScene } from "./templates";

const cases: [PrimitiveKind,string,unknown][] = [
  ["coordinate_canvas","domainX.0","-8"],
  ["function_region","expression","2*x+1"],
  ["vector_segment","end.0","5"],
  ["stamp_grid","activeCountExpr","6"],
  ["math_block","var:a","2"],
  ["control_slider","var:a","2"],
  ["geometric_shape","sideExpr","5"],
  ["data_chart","rows.1.valueExpr","7"],
  ["node_graph","edges.0.label","2/3"],
  ["annotation_stroke","points",[[1,2],[20,30]]],
  ["answer_field","answer","Mi respuesta"],
];
it.each(cases)("only edits an explicitly allowed problem value in %s", (kind,key,raw) => {
  const scene=newPrimitiveScene();
  if(kind==="function_region") scene.primitives.push(createPrimitive("coordinate_canvas",scene));
  const p=createPrimitive(kind,scene);
  if(p.kind==="node_graph") p.data.edges[0]!.label="1/2";
  scene.primitives.push(p);
  const original=structuredClone(scene);
  if(kind!=="answer_field") expect(()=>applyPracticeValue(scene,p.id,key,raw)).toThrow(/habilitó/);
  p.interaction={fields:[key]};
  const before=structuredClone(scene);
  const next=applyPracticeValue(scene,p.id,key,raw);
  expect(next).not.toEqual(before);
  expect(scene).toEqual(before);
  expect(next.primitives.find(item=>item.id===p.id)!.label).toBe(p.label);
  expect(()=>applyPracticeValue(scene,p.id,"label","Cambiar definición")).toThrow(/habilitó/);
  expect(()=>applyPracticeValue({...scene,primitives:scene.primitives.map(item=>item.id===p.id?{...item,interaction:{fields:["markdownContent","prompt","label","__proto__"]}}:item)},p.id,"label","Otra")).toThrow();
  expect(original.title).toBe(next.title);
});
it("preserves fraction constraints and the fixed numerator", () => {
  const scene=templateScene("practice-fractions"),p=scene.primitives.find(p=>p.kind==="geometric_shape")!;
  expect(()=>applyPracticeValue(scene,p.id,"shadedExpr","2")).toThrow(/habilitó/);
  for(const invalid of ["0","-1","2.5","49","NaN"]) expect(()=>applyPracticeValue(scene,p.id,"divisions",invalid)).toThrow();
  const next=applyPracticeValue(scene,p.id,"divisions","2");
  expect(next.primitives.find(item=>item.id===p.id)?.data).toMatchObject({divisions:2,shadedExpr:"1"});
});
it("permits only the requested table cell and recomputes a matrix while protecting inverse/results", () => {
  const scene=templateScene("practice-table"),table=scene.primitives.find(p=>p.kind==="data_chart")!;
  expect(()=>applyPracticeValue(scene,table.id,"rows.0.valueExpr","10")).toThrow();
  expect(applyPracticeValue(scene,table.id,"rows.1.valueExpr","4").primitives.find(p=>p.id===table.id)?.data).toMatchObject({rows:[{valueExpr:"2"},{valueExpr:"4"},{valueExpr:"6"}]});
  const matrix=templateScene("matrix-transform"),p=matrix.primitives.find(p=>p.kind==="data_chart" && p.data.chartType==="matrix")!;
  p.interaction={fields:["matrixCells.0.0"]};
  expect(()=>parsePrimitiveScene(applyPracticeValue(matrix,p.id,"matrixCells.0.0","2"))).not.toThrow();
  expect(()=>applyPracticeValue(matrix,p.id,"showInverse","false")).toThrow();
});
it("uses boolean inputs for logic rather than editable computed truth-table cells", () => {
  const scene=templateScene("logic-circuit");
  const graph=scene.primitives.find(p=>p.kind==="node_graph")!;
  const field=practiceFields(graph,scene).find(f=>f.key.startsWith("var:"))!;
  graph.interaction={fields:[field.key]};
  const value=scene.variables.find(v=>v.name===field.key.slice(4))!.value;
  expect(()=>applyPracticeValue(scene,graph.id,field.key,String(1-value))).not.toThrow();
  expect(()=>applyPracticeValue(scene,graph.id,field.key,"0.5")).toThrow();
  expect(()=>applyPracticeValue(scene,graph.id,"nodes.0.label","Cambia la puerta")).toThrow();
});
it("keeps definitions fixed and saves student answers on a separate attempt", () => {
  const original=templateScene("practice-line"),answer=original.primitives.find(p=>p.kind==="answer_field")!;
  const copy=practiceAttempt(original);
  expect(copy.id).not.toBe(original.id);
  const next=applyPracticeValue(copy,answer.id,"answer","2*x+1");
  expect(next.primitives.find(p=>p.id===answer.id)?.data).toMatchObject({answer:"2*x+1"});
  expect(answer.data).toMatchObject({answer:""});
  expect(()=>applyPracticeValue(copy,answer.id,"prompt","Nueva consigna")).toThrow();
  expect(()=>applyPracticeValue(copy,answer.id,"answer","alert(1)")).toThrow();
});

import { parsePrimitiveScene, type Primitive, type PrimitiveScene } from "./schema.ts";
import { scalar, sceneScope, sceneFunctions, compile } from "./math.ts";
export type PracticeField = { key: string; label: string; type: "text" | "number" | "drawing"; value: string; multiline?: boolean };
export function practiceFields(p: Primitive, scene: PrimitiveScene): PracticeField[] {
  const fields: PracticeField[] = [];
  const add = (key: string, label: string, value: string | number, type: PracticeField["type"] = "text") => fields.push({key,label,value:String(value),type});
  const pair = (key: string, label: string, values: string[]) => values.forEach((v,i)=>add(`${key}.${i}`,`${label} ${i===0?"x":"y"}`,v));
  switch(p.kind) {
    case "answer_field": fields.push({key:"answer",label:"Tu respuesta",value:p.data.answer,type:p.data.answerType==="number"?"number":"text",multiline:p.data.answerType==="text"}); break;
    case "coordinate_canvas":
      p.data.domainX.forEach((v,i)=>add(`domainX.${i}`,`Eje x: ${i?"máximo":"mínimo"}`,v));
      p.data.rangeY.forEach((v,i)=>add(`rangeY.${i}`,`Eje y: ${i?"máximo":"mínimo"}`,v));
      break;
    case "function_region":
      if(!p.data.curveMode || p.data.curveMode==="cartesian") add("expression","Función f(x)",p.data.expression);
      else for(const key of (p.data.curveMode==="parametric"?["xExpr","yExpr"]:["rExpr"]) as ("xExpr"|"yExpr"|"rExpr")[]) if(p.data[key]) add(key,key==="rExpr"?"Radio r(θ)":key==="xExpr"?"x(t)":"y(t)",p.data[key]);
      if(p.data.showArea) {add("fromExpr","Área: desde",p.data.fromExpr);add("toExpr","Área: hasta",p.data.toExpr);}
      if(p.data.showTangent) add("tangentAt","Tangente en x",p.data.tangentAt);
      if(p.data.parameterValueExpr) add("parameterValueExpr","Valor del parámetro",p.data.parameterValueExpr);
      break;
    case "vector_segment": pair("start","Inicio",p.data.start);pair("end","Final",p.data.end);break;
    case "stamp_grid": add("rowsExpr","Filas",p.data.rowsExpr);add("colsExpr","Columnas",p.data.colsExpr);add("activeCountExpr","Cantidad activa",p.data.activeCountExpr);break;
    case "solid_3d":
      if(["sphere","cylinder","cone"].includes(p.data.solid)) add("radiusExpr","Radio",p.data.radiusExpr);
      else {add("widthExpr","Ancho / lado",p.data.widthExpr);if(p.data.solid!=="cube") add("depthExpr","Profundidad",p.data.depthExpr);}
      if(!["cube","sphere"].includes(p.data.solid)) add("heightExpr","Altura",p.data.heightExpr);
      break;
    case "geometric_shape":
      if(["circle_fraction","sector"].includes(p.data.shape)) {add("divisions","Denominador",p.data.divisions,"number");add("shadedExpr","Numerador",p.data.shadedExpr);}
      if(!p.data.shape.startsWith("venn")) {
        if(["circle_fraction","sector","cylinder"].includes(p.data.shape)) add("radiusExpr","Radio",p.data.radiusExpr);
        else if(p.data.regular) add("sideExpr","Medida del lado",p.data.sideExpr);
        else p.data.verticesExpr.forEach((v,i)=>pair(`verticesExpr.${i}`,`Vértice ${i+1}`,v));
      }
      break;
    case "data_chart":
      if(p.data.chartType==="matrix") p.data.matrixCells?.forEach((row,i)=>row.forEach((v,j)=>add(`matrixCells.${i}.${j}`,`Celda ${i+1}, ${j+1}`,v)));
      else if(p.data.chartType!=="truth_table") p.data.rows.forEach((r,i)=>{
        if(["scatter","histogram"].includes(p.data.chartType) || p.data.headers.length===3) add(`rows.${i}.xExpr`,`${r.label}: x`,r.xExpr);
        add(`rows.${i}.valueExpr`,`${r.label || "Fila "+(i+1)}: valor`,r.valueExpr);
      });
      break;
    case "node_graph":
      if(p.data.graphType==="relations") p.data.edges.forEach((edge,i)=>{
        try { scalar(edge.label,sceneScope(scene));add(`edges.${i}.label`,`Valor de ${edge.from} → ${edge.to}`,edge.label); } catch { /* A relationship label is a definition. */ }
      });
      break;
    case "annotation_stroke": if(p.data.mode!=="callout_bubble") add("points","Dibujar respuesta","","drawing");break;
    case "math_block": case "control_slider": break;
  }
  // Only variables referenced by this element can be enabled from it.
  const source = p.kind==="math_block" ? (p.data.markdownContent.match(/\{\{[^}]+\}\}/g)??[]).join(" ") : p.kind==="annotation_stroke" ? "" : JSON.stringify(p.data);
  for(const v of scene.variables) if(new RegExp(`\\b${v.name}\\b`).test(source)) add(`var:${v.name}`,`Valor de ${v.name}${v.unit?" ("+v.unit+")":""}`,v.value,"number");
  return fields;
}
export function allowedPracticeFields(p: Primitive, scene: PrimitiveScene) {
  const allowed = new Set(p.interaction?.fields ?? []);
  return practiceFields(p,scene).filter(f=>p.kind==="answer_field" && f.key==="answer" || allowed.has(f.key));
}
function setPath(target: unknown, parts: string[], value: unknown): void {
  if(!target || typeof target!=="object") throw Error("Este valor ya no está disponible.");
  const key=parts[0]!;
  if(!Object.hasOwn(target,key)) throw Error("El campo no existe.");
  const object=target as Record<string,unknown>;
  if(parts.length===1) object[key]=value;
  else setPath(object[key],parts.slice(1),value);
}
export function applyPracticeValue(scene: PrimitiveScene, id: string, key: string, raw: unknown): PrimitiveScene {
  const original=scene.primitives.find(p=>p.id===id);
  if(!original) throw Error("El elemento no existe.");
  const field=allowedPracticeFields(original,scene).find(f=>f.key===key);
  if(!field) throw Error("El docente no habilitó este valor para el ejercicio.");
  const next=structuredClone(scene), p=next.primitives.find(p=>p.id===id)!;
  if(field.type==="drawing") {
    if(!Array.isArray(raw)) throw Error("Trazo inválido.");
    setPath(p.data,["points"],raw);
  } else {
    if(typeof raw!=="string" || !raw.trim()) throw Error("Escribe un valor.");
    const value=field.type==="number"?Number(raw.trim().replace(",", ".")):raw;
    if(field.type==="number" && !Number.isFinite(value)) throw Error("Escribe un número válido.");
    if(key.startsWith("var:")) {
      const variable=next.variables.find(v=>v.name===key.slice(4))!;
      const numeric=Number(value), steps=(numeric-variable.min)/variable.step;
      if(numeric<variable.min || numeric>variable.max || Math.abs(steps-Math.round(steps))>1e-7) throw Error("Respeta el rango y los incrementos del ejercicio.");
      variable.value=numeric;
    } else {
      if(p.kind==="answer_field" && key==="answer") {
        if(p.data.answerType==="expression") {
          if(/\bx\b/.test(String(value))) {
            // A response is syntax-checked, not graded. A finite sample cannot
            // establish whether an expression has a nonempty real domain.
            compile(String(value),sceneScope(scene));
          } else scalar(String(value),sceneScope(scene),sceneFunctions(scene));
        }
        p.data.answer=String(value);
      } else {
        if(p.kind==="node_graph" && key.startsWith("edges.")) scalar(String(value),sceneScope(scene),sceneFunctions(scene));
        setPath(p.data,key.split("."),value);
      }
    }
    if(p.kind==="coordinate_canvas") { p.data.autoFit=false;p.data.referenceWindow=null; }
  }
  return parsePrimitiveScene(next);
}
export function practiceAttempt(scene: PrimitiveScene): PrimitiveScene {
  return parsePrimitiveScene({...structuredClone(scene),id:crypto.randomUUID(),title:`Práctica · ${scene.title.replace(/^Práctica · /,"").replace(/^Practicar: /,"")}`.slice(0,160),conversation:[],appliedBuildIds:[],primitives:scene.primitives.map(p=>p.kind==="answer_field"?{...structuredClone(p),data:{...p.data,answer:""}}:structuredClone(p))});
}

/** Rebuild a submission from its allowed inputs. Any other change is rejected. */
export function validatePracticeAttempt(source: PrimitiveScene, input: unknown): PrimitiveScene {
  const candidate = parsePrimitiveScene(input);
  let expected = structuredClone(source);
  const at = (value: unknown, path: string): unknown => path.split(".").reduce<unknown>((v,k) => v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined, value);
  for (const primitive of source.primitives) {
    const changed = candidate.primitives.find(p => p.id === primitive.id);
    if (!changed || changed.kind !== primitive.kind) throw Error("No puedes reemplazar los elementos del ejercicio.");
    for (const field of allowedPracticeFields(primitive, source)) {
      const value = field.key.startsWith("var:")
        ? candidate.variables.find(v => v.name === field.key.slice(4))?.value
        : at(changed.data, field.key);
      const before = field.key.startsWith("var:")
        ? source.variables.find(v => v.name === field.key.slice(4))?.value
        : at(primitive.data, field.key);
      if (JSON.stringify(value) !== JSON.stringify(before)) {
        if (primitive.kind === "answer_field" && field.key === "answer" && value === "") {
          const target = expected.primitives.find(p => p.id === primitive.id)!;
          if (target.kind === "answer_field") target.data.answer = "";
        } else expected = applyPracticeValue(expected, primitive.id, field.key, field.type === "drawing" ? value : String(value));
      }
    }
  }
  expected.updatedAt = candidate.updatedAt;
  if (JSON.stringify(parsePrimitiveScene(expected)) !== JSON.stringify(candidate)) throw Error("Solo puedes modificar las respuestas y los valores habilitados por el docente.");
  return expected;
}

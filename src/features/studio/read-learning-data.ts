import type { LearningPayload } from "../../core/math-engine/learning-types";
export function readLearningData(object:LearningPayload,fields:FormData):LearningPayload {
  const read=(name:string)=>{const v=fields.get(`m_${name}`);if(typeof v!=="string" || !v.trim()) throw new Error("Completa todos los valores del módulo.");return v;};
  const num=(name:string)=>Number(read(name));
  const values=()=>{const parts=read("values").trim().split(/[,\s]+/);if(parts.some(x=>!x))throw new Error("No dejes datos vacíos entre comas.");return parts.map(Number);};
  switch(object.type) {
    case "regular-polygon": return {type:object.type,data:{sides:num("sides"),sideLength:num("sideLength"),unit:read("unit") as typeof object.data.unit}};
    case "percentage": return {type:object.type,data:{part:num("part"),whole:num("whole"),quantity:num("quantity"),task:read("task") as typeof object.data.task}};
    case "divisibility": return {type:object.type,data:{a:num("a"),b:num("b"),task:read("task") as typeof object.data.task}};
    case "angle": return {type:object.type,data:{degrees:num("degrees")}};
    case "circle": return {type:object.type,data:{...object.data,radius:num("radius"),task:read("task") as typeof object.data.task}};
    case "statistics": return {type:object.type,data:{values:values(),task:read("task") as typeof object.data.task}};
    case "probability": return {type:object.type,data:{experiment:read("experiment") as typeof object.data.experiment,outcomes:num("outcomes"),favorable:num("favorable"),trials:num("trials"),seed:num("seed")}};
    case "algebra-tiles": return {type:object.type,data:{a:num("a"),b:num("b"),c:num("c"),d:num("d")}};
    case "powers-roots": return {type:object.type,data:{base:num("base"),exponent:num("exponent"),task:read("task") as typeof object.data.task}};
    case "measurement": return {type:object.type,data:{value:num("value"),from:read("from") as typeof object.data.from,to:read("to") as typeof object.data.to}};
  }
}

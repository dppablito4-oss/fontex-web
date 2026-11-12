import { expect, it } from "vitest";
import { learningTypes, type LearningPayload, unitDefinitions } from "./learning-types";
import { learningLesson, percentageInfo, divisibilityInfo, angleInfo, circleInfo, statisticsInfo, probabilityInfo, powersInfo, measurementInfo, symbolicAnswer } from "./learning-modules";
import { createDocument, createObject } from "../object-registry/registry";
import { executeActions, readStudioContext } from "../agent/actions";
import { parseDocument } from "../document-schema/document";
import { exactTarget, equivalentAnswer, practiceReply } from "../agent/pedagogy";
it.each(learningTypes)("integra %s en validación, contexto, acciones y JSON",type=>{
  const doc=createDocument("blank"),object=createObject(type);
  const next=executeActions(doc,{documentId:doc.id,actions:[{kind:"create",object}]},doc);
  expect(parseDocument(JSON.parse(JSON.stringify(next)))).toEqual(next);
  expect(readStudioContext(next).mathematics[0]).toHaveProperty("calculation");
  expect(exactTarget(object)).toBeTruthy();
  expect(learningLesson(object as LearningPayload).steps.length).toBe(4);
});
it("calcula porcentajes, descuento restante y razones mayores que uno exactamente",()=>{
  expect(percentageInfo({part:1,whole:3,quantity:100,task:"portion"}).answer).toEqual({n:100,d:3});
  expect(percentageInfo({part:25,whole:100,quantity:200,task:"discount"}).answer).toEqual({n:150,d:1});
  expect(percentageInfo({part:3,whole:2,quantity:10,task:"ratio"}).answer).toEqual({n:15,d:1});
  expect(()=>percentageInfo({part:3,whole:2,quantity:10,task:"discount"})).toThrow();
});
it("comprueba divisibilidad y relación MCD×MCM en números coprimos y con repeticiones",()=>{
  for(const [a,b] of [[12,18],[8,9],[360,359],[64,32],[7,7]]) {
    const v=divisibilityInfo({a:a!,b:b!,task:"gcd"});
    expect(a!%v.gcd).toBe(0);expect(b!%v.gcd).toBe(0);
    expect(v.lcm%a!).toBe(0);expect(v.lcm%b!).toBe(0);
    expect(v.gcd*v.lcm).toBe(a!*b!);
  }
});
it("clasifica los límites de los ángulos y distingue cero de vuelta completa",()=>{
  for(const [degrees,name] of [[0,"nulo"],[45,"agudo"],[90,"recto"],[120,"obtuso"],[180,"llano"],[270,"cóncavo"],[360,"completo"]] as const)expect(angleInfo({degrees}).classification).toBe(name);
  expect(()=>angleInfo({degrees:361})).toThrow();
});
it("conserva π exacto y verifica formatos simbólicos",()=>{
  expect(circleInfo({radius:3,task:"area"}).coefficient).toBe(9);
  expect(circleInfo({radius:3,task:"circumference"}).coefficient).toBe(6);
  expect(symbolicAnswer("9π",{pi:9})).toBe(true);
  expect(symbolicAnswer("18/2*pi",{pi:9})).toBe(true);
  expect(symbolicAnswer("28.274",{pi:9})).toBeNull();
  expect(symbolicAnswer("9/0*pi",{pi:9})).toBeNull();
});
it("calcula medianas pares, fracciones, empates de moda y ausencia de moda",()=>{
  const d=statisticsInfo({values:[1,2,2,7],task:"median"});
  expect(d.median).toEqual({n:2,d:1});expect(d.mean).toEqual({n:3,d:1});
  expect(statisticsInfo({values:[0,1],task:"median"}).median).toEqual({n:1,d:2});
  expect(statisticsInfo({values:[1,1,2,2,3],task:"mode"}).modes).toEqual([1,2]);
  expect(symbolicAnswer("2, 1",{values:[1,2]})).toBe(true);
  expect(symbolicAnswer("sin moda",{values:[]})).toBe(true);
  expect(statisticsInfo({values:[1,2,3],task:"mode"}).modes).toEqual([]);
});
it("simula ensayos reproducibles sin alterar probabilidades teóricas",()=>{
  const d={experiment:"dice" as const,outcomes:6,favorable:2,trials:200,seed:12345};
  const a=probabilityInfo(d),b=probabilityInfo(d);
  expect(a.samples).toEqual(b.samples);expect(a.counts.reduce((a,b)=>a+b,0)).toBe(200);
  expect(a.samples.every(n=>n>=1&&n<=6)).toBe(true);expect(a.theoretical).toEqual({n:1,d:3});
  expect(a.successes).toBe(a.counts[0]!+a.counts[1]!);
  expect(probabilityInfo({...d,favorable:0}).successes).toBe(0);
  expect(probabilityInfo({...d,favorable:6}).successes).toBe(200);
  expect(probabilityInfo({...d,seed:54321}).samples).not.toEqual(a.samples);
  expect(()=>probabilityInfo({...d,experiment:"coin"})).toThrow();
});
it("resuelve álgebra con piezas incluyendo casos sin solución e infinitos",()=>{
  for(const [data,attempt] of [[{a:2,b:3,c:0,d:11},"4"],[{a:1,b:3,c:1,d:4},"sin solución"],[{a:1,b:3,c:1,d:3},"infinitas"]] as const){
    const doc=createDocument("blank"),object={...createObject("algebra-tiles"),type:"algebra-tiles" as const,data};doc.objects=[object];
    expect(practiceReply({document:doc,selectedId:object.id,mode:"practice",level:"primary",question:"Resuelve",attempt,hintLevel:0}).message).toContain("equivalente");
  }
});
it("distingue potencias de multiplicación y raíces perfectas",()=>{
  expect(powersInfo({base:4,exponent:3,task:"power"}).answer).toBe(64);
  expect(powersInfo({base:4,exponent:3,task:"root"}).answer).toBe(4);
  expect(powersInfo({base:0,exponent:2,task:"root"}).answer).toBe(0);
  expect(()=>powersInfo({base:4,exponent:1,task:"root"})).toThrow();
});
it("convierte magnitudes compatibles de forma exacta, incluida superficie y tiempo",()=>{
  expect(measurementInfo({value:1,from:"m2",to:"cm2"}).answer).toEqual({n:10000,d:1});
  expect(measurementInfo({value:90,from:"s",to:"min"}).answer).toEqual({n:3,d:2});
  expect(measurementInfo({value:10000,from:"km",to:"mm"}).answer).toEqual({n:10000000000,d:1});
  expect(equivalentAnswer("10000000000",{n:10000000000,d:1})).toBe(true);
  expect(equivalentAnswer("10000000001",{n:10000000000,d:1})).toBe(false);
  expect(equivalentAnswer("1,5",{n:3,d:2})).toBe(true);
  expect(()=>measurementInfo({value:1,from:"m",to:"m2"})).toThrow();
  for(const from of Object.keys(unitDefinitions) as (keyof typeof unitDefinitions)[])for(const to of Object.keys(unitDefinitions) as (keyof typeof unitDefinitions)[]){
    if(unitDefinitions[from].family!==unitDefinitions[to].family)continue;
    const {answer}=measurementInfo({value:7,from,to});
    expect(BigInt(answer.n)*BigInt(unitDefinitions[to].scale)).toBe(7n*BigInt(unitDefinitions[from].scale)*BigInt(answer.d));
  }
});
it("rechaza cargas inválidas en los documentos sin ejecutar código",()=>{
  const invalid=[{type:"percentage",data:{part:1,whole:0,quantity:100,task:"portion"}},{type:"statistics",data:{values:[],task:"mean"}},{type:"probability",data:{experiment:"dice",outcomes:6,favorable:7,trials:60,seed:1}},{type:"measurement",data:{value:1,from:"L",to:"cm"}},{type:"angle",data:{degrees:"90"}}];
  for(const value of invalid)expect(()=>parseDocument({...createDocument("blank"),objects:[{...createObject("text"),...value}]})).toThrow();
});

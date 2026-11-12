import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { learningTypes } from "../../core/math-engine/learning-types";
import { createDocument, createObject } from "../../core/object-registry/registry";
import { GuidedObject } from "./GuidedObject";
import { PropertiesInspector } from "./PropertiesInspector";
import { TeachingMode } from "./teaching-mode";
import { printableMaterial } from "./export-pdf";
import { explainStepReply, isExerciseIntent } from "./agent-intents";
it.each(learningTypes)("representa y permite editar %s sin perder sus datos",type=>{
  const object=createObject(type),apply=vi.fn();
  const view=render(<GuidedObject object={object}/>);
  expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
  expect(screen.getByRole("button",{name:"Siguiente paso"})).toBeInTheDocument();
  view.unmount();render(<PropertiesInspector object={object} onApply={apply}/>);
  fireEvent.click(screen.getByRole("button",{name:"Aplicar cambios"}));
  expect(apply).toHaveBeenCalledWith(object);
});
it.each([["percentage","50"],["divisibility","6"],["angle","60"],["circle","9π"],["statistics","4"],["probability","1/3"],["algebra-tiles","4"],["powers-roots","16"],["measurement","200"]] as const)("practica %s y comprueba una respuesta compatible",(type,answer)=>{
  render(<TeachingMode.Provider value="practice"><GuidedObject object={createObject(type)}/></TeachingMode.Provider>);
  expect(screen.queryByText("RESOLUCIÓN COMPLETA")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Respuesta del módulo"),{target:{value:answer}});
  fireEvent.click(screen.getByRole("button",{name:"Comprobar respuesta"}));
  expect(screen.getByRole("status")).toHaveTextContent("equivalente");
});
it("reserva el resultado de porcentajes hasta pedir comprobación",()=>{
  render(<TeachingMode.Provider value="practice"><GuidedObject object={createObject("percentage")}/></TeachingMode.Provider>);
  expect(screen.queryByText("Corresponde")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Dame una pista"}));
  expect(screen.getByRole("status")).not.toHaveTextContent("Comprobación:");
  fireEvent.click(screen.getByRole("button",{name:"Mostrar comprobación"}));
  expect(screen.getByRole("status")).toHaveTextContent("Comprobación: 50");
});
it("exporta todos los módulos y todas las explicaciones sin depender del zoom",()=>{
  const doc=createDocument("blank");doc.objects=learningTypes.map(type=>createObject(type));
  const html=printableMaterial(doc,"primary");
  for(const object of doc.objects)expect(html).toContain(object.label);
  expect(html).toContain("Probabilidad teórica");expect(html).toContain("Media exacta");expect(html).toContain("9π");
});
it("explica solo un paso calculado, sin acciones ni proveedor",()=>{
  const doc=createDocument("blank"),object=createObject("measurement");doc.objects=[object];
  const request={document:doc,selectedId:object.id,mode:"learn" as const,level:"primary" as const,question:"Explica solo el paso 2",attempt:"",hintLevel:0};
  const reply=explainStepReply(request)!;
  expect(reply.message).toContain("Paso 2: Relaciona las unidades");
  expect(reply.message).not.toContain("Paso 3");expect(reply.batch.actions).toEqual([]);
  expect(()=>explainStepReply({...request,question:"Explica solo el paso 9"})).toThrow();
  expect(isExerciseIntent("Convierte esto en ejercicio")).toBe(true);
});
it("el inspector impide convertir longitud en capacidad",()=>{
  const apply=vi.fn();render(<PropertiesInspector object={createObject("measurement")} onApply={apply}/>);
  fireEvent.change(screen.getByLabelText("Unidad final"),{target:{value:"L"}});
  fireEvent.click(screen.getByRole("button",{name:"Aplicar cambios"}));
  expect(screen.getByRole("alert")).toBeInTheDocument();expect(apply).not.toHaveBeenCalled();
});

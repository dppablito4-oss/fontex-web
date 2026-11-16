import {expect,it} from "vitest";
import {scalar} from "./math";
it("supports bounded variadic extrema in linked canvas measurements",()=>{
 expect(scalar("max(1,-5,4,2)",{})).toBe(4);
 expect(scalar("min(1,-5,4,2)",{})).toBe(-5);
 expect(scalar("max(4)",{})).toBe(4);
 expect(scalar("max(abs(a),abs(b),min(9,c,10))",{a:-2,b:5,c:7})).toBe(7);
 expect(scalar("max(1,v0*t+a*t^2/2,0)",{v0:4,a:2,t:5})).toBe(45);
 expect(()=>scalar(`max(${Array(33).fill("1").join(",")})`,{})).toThrow(/argumentos/);
 expect(()=>scalar("round(1,2,3)",{})).toThrow(/argumentos/);
 expect(()=>scalar("max()",{})).toThrow();
});

it("lets diagrams and tables refer to the calculated area of an earlier function",async()=>{
 const {createPrimitive,newPrimitiveScene,parsePrimitiveScene}=await import("./schema");
 const {sceneScope}=await import("./math");
 const scene=newPrimitiveScene();scene.variables=[{name:"v0",value:4,min:0,max:20,step:.5,unit:"m/s"},{name:"a",value:2,min:-5,max:10,step:.5,unit:"m/s²"},{name:"t",value:5,min:1,max:15,step:1,unit:"s"}];
 const plane=createPrimitive("coordinate_canvas",scene);scene.primitives.push(plane);
 const curve=createPrimitive("function_region",scene);curve.data.canvasId=plane.id;curve.data.expression="v0+a*x";curve.data.showArea=true;curve.data.fromExpr="0";curve.data.toExpr="t";curve.data.resultName="despl";scene.primitives.push(curve);
 const motion=createPrimitive("coordinate_canvas",scene);motion.data.domainX=["min(-10,despl-10)","max(10,despl+10)"];scene.primitives.push(motion);
 const vector=createPrimitive("vector_segment",scene);vector.data.canvasId=motion.id;vector.data.start=["despl","0"];vector.data.end=["despl+1","0"];scene.primitives.push(vector);
 expect(sceneScope(parsePrimitiveScene(scene)).despl).toBeCloseTo(45);
 scene.variables[1]!.value=-2;expect(sceneScope(parsePrimitiveScene(scene)).despl).toBeCloseTo(-5);
});

it("preserves uppercase physical parameters without changing the local plotting coordinate",async()=>{
 const {createPrimitive,newPrimitiveScene,parsePrimitiveScene}=await import("./schema");
 const scene=newPrimitiveScene();scene.variables=[{name:"T",value:5,min:1,max:15,step:1,unit:"s"}];
 const control=createPrimitive("control_slider",scene);control.data.variableName="T";scene.primitives.push(control);
 expect(parsePrimitiveScene(scene).variables[0]!.name).toBe("T");
 expect(scalar("4*T+2*T^2/2",{T:5})).toBe(45);
 expect(()=>parsePrimitiveScene({...scene,variables:[{...scene.variables[0]!,name:"X"}]})).toThrow(/nombre/);
});

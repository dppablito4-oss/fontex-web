import { expect, test } from "@playwright/test";
import { createPrimitive, newPrimitiveScene, parsePrimitiveScene } from "../src/core/primitives/schema";

test("updates a polygon, helper curve, line chart and node formula without generating a lesson", async ({ page }) => {
  const scene=newPrimitiveScene("Prueba de expresiones");scene.variables[0]={name:"a",value:4,min:3,max:8,step:1,unit:""};
  const control=createPrimitive("control_slider",scene);scene.primitives.push(control);
  const plane=createPrimitive("coordinate_canvas",scene);plane.label="Plano de prueba";scene.primitives.push(plane);
  const curve=createPrimitive("function_region",scene);curve.data.canvasId=plane.id;curve.data.expression="floor(x)+sin(x)";curve.data.showArea=false;scene.primitives.push(curve);
  const shape=createPrimitive("geometric_shape",scene);shape.data.canvasId=plane.id;shape.data.regular=true;shape.data.sidesExpr="a";shape.data.rotationExpr="a*10";scene.primitives.push(shape);
  const chart=createPrimitive("data_chart",scene);chart.label="Datos de prueba";chart.data.chartType="line";chart.data.rows=[{label:"A",xExpr:"1",valueExpr:"floor(a)"},{label:"B",xExpr:"2",valueExpr:"10"}];scene.primitives.push(chart);
  const graph=createPrimitive("node_graph",scene);graph.label="Nodo de prueba";graph.data.nodes[0].formula="$q={{floor(a)}}$";scene.primitives.push(graph);
  let aiCalls=0;await page.route("**/functions/v1/**",route=>{aiCalls++;return route.abort();});
  await page.goto("/#/lienzo");
  await page.locator('input[type="file"]').setInputFiles({name:"Expresiones.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(parsePrimitiveScene(scene)))});
  const close=page.getByRole("button",{name:"Cerrar panel",exact:true});if(await close.count())await close.click();
  const chartView=page.getByRole("article",{name:"Datos de prueba",exact:true});
  await expect(chartView.locator('polyline[aria-label="Línea de datos"]')).toHaveCount(1);
  const graphView=page.getByRole("article",{name:"Nodo de prueba",exact:true});
  await expect(graphView.locator("foreignObject .katex")).toHaveCount(1);
  await expect(graphView.locator("foreignObject")).toContainText("q=4");
  const slider=page.getByRole("slider",{name:"Variable a",exact:true});await slider.fill("6");await slider.dispatchEvent("input");await slider.dispatchEvent("change");
  await expect(graphView.locator("foreignObject")).toContainText("q=6");
  await expect(chartView.getByRole("row").nth(1)).toContainText("6");
  await expect(page.locator(".pc-board .katex-error")).toHaveCount(0);
  expect(aiCalls).toBe(0);
});

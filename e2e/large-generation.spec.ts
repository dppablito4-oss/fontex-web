import {expect,test} from "@playwright/test";
import {readFileSync} from "node:fs";
import {parsePrimitiveScene} from "../src/core/primitives/schema";
const source=readFileSync(new URL("./fixtures/kinematics-scene.json",import.meta.url));
const scene=parsePrimitiveScene(JSON.parse(source.toString()));
test("renders a complete linked kinematics exercise and recalculates the fixed student case",async({page})=>{
 await page.goto("/#/lienzo");
 await page.locator('input[type="file"]').setInputFiles({name:"Cinematica.json",mimeType:"application/json",buffer:source});
 const close=page.getByRole("button",{name:"Cerrar panel",exact:true});if(await close.count())await close.click();
 await expect(page.getByRole("article",{name:"Tabulación automática de seis instantes",exact:true})).toBeVisible();
 for(const [name,value]of[["v0","4"],["a","2"],["ho","5"]]){
   const slider=page.getByRole("slider",{name:`Variable ${name}`,exact:true});
   await slider.fill(value);await slider.dispatchEvent("input");await slider.dispatchEvent("change");
 }
 const table=page.getByRole("article",{name:"Tabulación automática de seis instantes",exact:true}).getByRole("table");
 await expect(table.getByRole("columnheader")).toHaveCount(3);
 await expect(table.getByRole("row").last()).toContainText("14");
 await expect(table.getByRole("row").last()).toContainText("45");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("fontex-primitives-v2:guest")??"null") as {scenes:{primitives:unknown[]}[]}|null);
 expect(saved?.scenes.find(s=>s.primitives.length===scene.primitives.length)).toBeTruthy();
 await expect(page.locator('.pc-board .katex-error')).toHaveCount(0);
});

test("opens the integrated kinematics template immediately without an AI request",async({page})=>{
 let aiCalls=0;await page.route("**/functions/v1/**",route=>{aiCalls++;return route.abort();});
 await page.goto("/#/lienzo");
 await page.getByRole("button",{name:"Plantillas",exact:true}).click();
 await page.getByRole("textbox",{name:"Buscar plantilla"}).fill("Cinemática");
 await page.getByRole("button",{name:/Cinemática: área y movimiento/}).click();
 const table=page.getByRole("article",{name:"Tabulación automática de seis instantes",exact:true}).getByRole("table");
 await expect(table.getByRole("columnheader")).toHaveCount(3);
 expect(aiCalls).toBe(0);
});

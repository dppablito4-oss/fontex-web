import {expect,test,type Page} from "@playwright/test";
import {jsPDF} from "jspdf";
import {templateScene} from "../src/core/primitives/templates";
const classroom="c0920000-0000-4000-8000-000000000001",lessonId="c0920000-0000-4000-8000-000000000002",teacherId="c0920000-0000-4000-8000-000000000003";
const scene=templateScene("practice-fractions");
const guest={id:"c0920000-0000-4000-8000-000000000004",token:"a".repeat(64),display_name:"Ana",classroom_id:classroom,title:"GRUPOFontex",expires_at:new Date(Date.now()+8*3600000).toISOString()};
const lesson={id:lessonId,classroom_id:classroom,title:"Fracciones para practicar",topic:"Fracciones",week:2,class_date:"2026-11-16",instructions:"Cambia solo el denominador y escribe tu explicación.",due_at:null,scene,teacher:false,attachments:[{path:`${classroom}/${teacherId}/ficha.pdf`,name:"Ficha de práctica.pdf",type:"application/pdf"}],submission:null,status:null,deliveries:0};
async function backend(page:Page,teacher=false){
  await page.route("https://classroom-test.invalid/**",async route=>{
    const url=new URL(route.request().url()),path=url.pathname;let data:unknown=[];
    if(route.request().method()==="OPTIONS"){await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});return;}
    if(path.endsWith("get_classroom_guest"))data=guest;
    if(path.endsWith("get_beta_access_status"))data={allowed:true};
    if(path.endsWith("get_guest_ai_status"))data={balance:5,initial_credits:5,is_admin:false,active_generation:false};
    if(path.endsWith("list_class_lessons"))data=[lesson];
    if(path.endsWith("get_class_lesson"))data={...lesson,teacher};
    if(path.endsWith("teacher_classrooms"))data=[{id:classroom,title:"GRUPOFontex"},{id:"c0920000-0000-4000-8000-000000000005",title:"Otro grupo"}];
    if(path.endsWith("publish_class_lesson"))data=lessonId;
    if(path.endsWith("classroom-api")) {
      const body=route.request().postDataJSON() as {action:string};
      data=body.action==="material"?{url:"https://classroom-test.invalid/ficha.pdf"}:{id:"submission",message:"Clase publicada. Avisos enviados."};
    }
    if(path.endsWith("/ficha.pdf")){
      const pdf=new jsPDF();pdf.text("Ficha de practica de fracciones",20,20);
      await route.fulfill({status:200,body:Buffer.from(pdf.output("arraybuffer")),contentType:"application/pdf",headers:{"access-control-allow-origin":"*"}});return;
    }
    if(path.endsWith("/profiles"))data=url.searchParams.has("id") && url.searchParams.get("id")?.startsWith("in.")?[{id:teacherId,display_name:"Docente"}]:{id:teacherId,display_name:"Docente"};
    if(path.endsWith("/classrooms"))data=[{id:classroom,organization_id:classroom,title:"GRUPOFontex",term:"2026-II",owner_id:teacherId}];
    if(path.endsWith("/class_members"))data=[{user_id:teacherId,role:"teacher",status:"active"}];
    if(path.endsWith("/visual_scenes"))data=url.searchParams.get("select")==="scene"?{scene}:[{id:scene.id,scene_title:scene.title}];
    await route.fulfill({status:200,json:data,headers:{"access-control-allow-origin":"*"}});
  });
  if(teacher){await page.addInitScript(({id})=>{
    const user={id,email:"teacher@example.invalid",aud:"authenticated",role:"authenticated",email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{},user_metadata:{display_name:"Docente"}};
    const payload=btoa(JSON.stringify({sub:id,role:"authenticated",exp:Math.floor(Date.now()/1000)+3600}));
    localStorage.setItem("sb-classroom-test-auth-token",JSON.stringify({access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.test`,refresh_token:"test",expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:"bearer",user}));
  },{id:teacherId});}
  else await page.addInitScript(value=>localStorage.setItem("fontex-classroom-guest-v1",JSON.stringify(value)),guest);
}
test("guest opens the classroom, practices and submits without registering",async({page})=>{
 await backend(page);await page.goto("/#/aula");
 await expect(page.getByRole("heading",{name:"GRUPOFontex",exact:true})).toBeVisible();
 await expect(page.getByText("Semana 2",{exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Abrir clase y practicar"}).click();
 await expect(page.getByText(lesson.instructions)).toBeVisible();
 await page.getByRole("button",{name:"Cambiar Denominador"}).click();
 await page.getByRole("textbox",{name:"Denominador",exact:true}).fill("8");
 await page.getByRole("button",{name:"Aplicar Denominador"}).click();
 await expect(page.getByText("Respuestas sin guardar")).toBeVisible();
 const saving=page.waitForRequest(r=>r.url().endsWith("/classroom-api") && r.method()==="POST");
 await page.getByRole("button",{name:"Entregar actividad"}).click();
 const request=await saving;const body=request.postDataJSON() as {submit:boolean;scene:{primitives:{kind:string;data:{divisions?:number}}[]}};
 expect(request.headers()["x-classroom-guest"]).toBe(guest.token);expect(body.submit).toBe(true);
 expect(body.scene.primitives.find(p=>p.kind==="geometric_shape")?.data.divisions).toBe(8);
 await expect(page.getByText("Actividad entregada al docente.")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:test.info().outputPath("actividad-en-aula.png"),fullPage:true});
});
test("teacher selects a canvas card and chooses the classroom for publication",async({page})=>{
 await backend(page,true);await page.goto("/#/aula");
 await expect(page.getByRole("heading",{name:"Elige un lienzo y publícalo"})).toBeVisible();
 await page.getByRole("radio",{name:"Seleccionar para publicar"}).check();
 await page.getByRole("button",{name:"Publicar seleccionado"}).click();
 const dialog=page.getByRole("dialog",{name:"Publicar lienzo en un aula"});await expect(dialog).toBeVisible();
 await dialog.getByRole("combobox",{name:"Aula de destino"}).selectOption(classroom);
 await dialog.getByRole("textbox",{name:"Título de la clase"}).fill("Sumar fracciones");
 await dialog.getByRole("textbox",{name:"Actividad e instrucciones"}).fill("Resuelve y entrega tu respuesta.");
 await page.screenshot({path:test.info().outputPath("publicar-lienzo-en-aula.png"),fullPage:true});
 await dialog.getByRole("button",{name:"Publicar actividad",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Clase publicada"})).toBeVisible();
 await expect(page.getByRole("link",{name:"Abrir clase y entregas",exact:true}).last()).toBeVisible();
});

test("guest reads the attached PDF inside the Fontex viewer",async({page})=>{
 await backend(page);await page.goto(`/#/clase/${lessonId}`);
 await page.getByRole("button",{name:"PDF · Ficha de práctica.pdf"}).click();
 const viewer=page.getByRole("dialog",{name:"Ficha de práctica.pdf"});await expect(viewer).toBeVisible();
 await expect(viewer.locator("canvas")).toBeVisible();
 await expect(viewer.getByRole("button",{name:"Descargar PDF",exact:true})).toBeVisible();
 await viewer.getByRole("button",{name:"Cerrar visor"}).click();await expect(viewer).toHaveCount(0);
});

// Explicit opt-in: three real generation requests; scenes stay in memory.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { eventData } from '../src/core/agent/event-stream.ts';
import { applyPrimitivePatch, newPrimitiveScene } from '../src/core/primitives/schema.ts';
import { templateScene } from '../src/core/primitives/templates.ts';
import { graphValues } from '../src/core/primitives/logic.ts';
for (const name of ['SUPABASE_TEST_URL','SUPABASE_TEST_PUBLISHABLE_KEY','FONTEX_TEST_EMAIL','FONTEX_TEST_PASSWORD']) assert.ok(process.env[name],`Missing ${name}`);
assert.equal(process.env.FONTEX_RUN_PAID_AGENT_TESTS,'1','Set FONTEX_RUN_PAID_AGENT_TESTS=1 to authorize three real AI requests.');
const client=createClient(process.env.SUPABASE_TEST_URL,process.env.SUPABASE_TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const login=await client.auth.signInWithPassword({email:process.env.FONTEX_TEST_EMAIL,password:process.env.FONTEX_TEST_PASSWORD});assert.ifError(login.error);
const scenarios=[
 {name:'parametric',question:'No cargues plantillas. En este lienzo vacío crea un coordinate_canvas equalScale true y una function_region parametric que dibuje la elipse xExpr="3*cos(t)", yExpr="2*sin(t)", parameterFromExpr="0", parameterToExpr="2*pi". Usa expression="0", showArea/showDerivative/showTangent=false y pointXs=[]. Añade otra function_region polar rExpr="2*cos(3*theta)" entre 0 y 2*pi. Ángulos radianes. Sólo esos tres elementos, sin textos adicionales.'},
 {name:'logic',question:'No cargues plantillas. Declara p=1 y q=0, ambas min0,max1,step1. Crea un data_chart truth_table de p && q y un geometric_shape venn_2 con las mismas logicVariables [p,q], logicExpression "p && q", setLabels [A,B] y canvasId null. Añade un node_graph logic con cuatro nodos: dos input para p y q, un and con ambas entradas y un output conectado al and. Los nodos llevan id,label,type,variableName (null salvo input),x,y; las aristas from,to,label. No añadas controles ni textos; las entradas del circuito son interactivas.'},
 {name:'matrix',question:'No cargues plantillas. Usa la variable a ya existente. Crea data_chart matrix de nombre m con matrixCells [["a","1"],["0","1"]] y showInverse true. Añade un plano equalScale true y un geometric_shape polygon irregular con vértices [0,0],[2,0],[0,2], ligado al plano y a la matriz mediante transformMatrixId. Añade un math_block transparente con el contenido "Determinante: {{det(m)}}. Inversa: {{inv(m)}}". Sólo esos cuatro elementos. Completa los campos requeridos y conserva referencias válidas.'},
];
try {
  for(const scenario of scenarios){
    const scene=newPrimitiveScene(`QA beta ${scenario.name}`);
    const result=await client.functions.invoke('studio-agent/primitives',{body:{scene,task:'build',question:scenario.question,selectedId:null,level:'universidad'},timeout:60000});assert.ifError(result.error);
    const stream=result.data instanceof ReadableStream?result.data:result.data instanceof Response?result.data.body:null;assert.ok(stream,'Expected SSE');
    let reply,events=0;for await(const event of eventData(stream)){if(event.type==='error')throw Error(String(event.message));if(event.type==='text')events++;if(event.type==='result')reply=event.reply;}
    assert.ok(reply,'Missing validated proposal');const built=applyPrimitivePatch(scene,reply,templateScene);
    assert.equal(reply.actions.some(a=>a.kind==='load_template'),false,'Expected generated structures rather than a template shortcut');
    if(scenario.name==='parametric'){assert.ok(built.primitives.some(p=>p.kind==='function_region'&&p.data.curveMode==='parametric'));assert.ok(built.primitives.some(p=>p.kind==='function_region'&&p.data.curveMode==='polar'));}
    if(scenario.name==='logic'){const graph=built.primitives.find(p=>p.kind==='node_graph');assert.ok(graph);assert.ok(built.primitives.some(p=>p.kind==='geometric_shape'&&p.data.shape==='venn_2'));assert.ok(built.primitives.some(p=>p.kind==='data_chart'&&p.data.chartType==='truth_table'));const output=graph.data.nodes.find(n=>n.type==='output');assert.ok(output);assert.equal(graphValues(graph.data.nodes,graph.data.edges,{p:1,q:1})[output.id],true);}
    if(scenario.name==='matrix'){assert.ok(built.primitives.some(p=>p.kind==='data_chart'&&p.data.chartType==='matrix'));assert.ok(built.primitives.some(p=>p.kind==='geometric_shape'&&p.data.transformMatrixId));}
    if(process.env.FONTEX_QA_ARTIFACT_DIR){const{writeFile}=await import('node:fs/promises');await writeFile(`${process.env.FONTEX_QA_ARTIFACT_DIR}/v080-generated-${scenario.name}.json`,JSON.stringify(built,null,2),{mode:0o600});}
    console.log(JSON.stringify({scenario:scenario.name,result:'passed',streamedTextEvents:events,kinds:built.primitives.map(p=>p.kind)}));
  }
  console.log(JSON.stringify({realProviderRequests:3,result:'passed',writesToDatabase:0}));
} finally {await client.auth.signOut({scope:'local'});}

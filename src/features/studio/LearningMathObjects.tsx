import { InlineValue, InlineOnly, InlineEquation, InlineSvgValue } from "./InlineValue";
import { useId } from "react";
import type { LearningPayload, LearningDataMap } from "../../core/math-engine/learning-types";
import { percentageInfo, divisibilityInfo, circleInfo, statisticsInfo, probabilityInfo, algebraTilesInfo, powersInfo, measurementInfo, fractionText } from "../../core/math-engine/learning-modules";
import { linearSide, equationResult } from "../../core/math-engine/equations";
import { toRadians } from "../../core/vendor/mathigon";
type Display = { step: number; hidden: boolean };
function Amount({label,children}:{label:string;children:React.ReactNode}) {return <div className="st-learning-amount"><small>{label}</small><strong>{children}</strong></div>;}
function PercentagePicture({data,step,hidden}:{data:LearningDataMap["percentage"]}&Display) {
  const a=percentageInfo(data),percent=data.part/data.whole*100;
  return <div className="st-percent-picture">{percent>100?<svg viewBox="0 0 300 130" role="img" aria-label={`Razón de ${data.part} por cada ${data.whole}`}><rect x="0" y="15" width="280" height="32" fill="var(--st-piece-primary)"/><text x="8" y="38" fill="var(--st-ink)" fontSize="18">{data.part}</text><rect x="0" y="75" width={280*data.whole/data.part} height="32" fill="var(--st-piece-secondary)"/><text x="8" y="100" fill="var(--st-ink)" fontSize="18">{data.whole}</text></svg>:<svg viewBox="0 0 220 220" role="img" aria-label={`${data.part} de ${data.whole} de una unidad, representados sobre 100 celdas`}>
    {Array.from({length:100},(_,i)=><g key={i}><rect x={i%10*22} y={Math.floor(i/10)*22} width="20" height="20" rx="2" fill="var(--st-piece-empty)"/><rect x={i%10*22} y={Math.floor(i/10)*22} width={Math.min(1,Math.max(0,percent-i))*20} height="20" rx="2" fill="var(--st-piece-primary)"/></g>)}
  </svg>}<InlineOnly><p className="st-inline-caption"><InlineValue field="task" value={data.task} /> · <InlineValue field="part" value={data.part} /> / <InlineValue field="whole" value={data.whole} /></p></InlineOnly><p>{percent>100?`Por cada ${data.whole} unidades de referencia corresponden ${data.part}; la razón supera una unidad.`:`${data.part}/${data.whole} de la unidad · cada celda equivale a 1 %. Una celda parcialmente coloreada representa una fracción de porcentaje.`}</p><div className="st-learning-amounts"><Amount label="Total"><InlineValue field="quantity" value={data.quantity} /></Amount>{!hidden&&step>=2&&<Amount label={data.task==="discount"?"Queda":"Corresponde"}>{fractionText(a.answer)}</Amount>}</div></div>;
}
function DivisibilityPicture({data,step,hidden}:{data:LearningDataMap["divisibility"]}&Display) {
  const a=divisibilityInfo(data);
  return <div className="st-divisibility-picture"><InlineOnly><p className="st-inline-caption">Buscar: <InlineValue field="task" value={data.task} /></p></InlineOnly>{[[data.a,a.left],[data.b,a.right]].map(([n,factors],index)=><div className="st-prime-row" role="img" aria-label={`${n as number} = ${(factors as number[]).join(" × ")}`} key={index}><strong><InlineValue field={index === 0 ? "a" : "b"} value={n as number} /></strong><span>=</span><div>{(factors as number[]).map((p,i)=><span className="st-prime-chip" key={i}>{p}</span>)}</div></div>)}<p>Compara cuántas veces aparece cada primo. Las repeticiones también cuentan.</p>{!hidden&&step>=1&&<Amount label="MCD">{a.gcd}</Amount>}{!hidden&&step>=2&&<Amount label="MCM">{a.lcm}</Amount>}</div>;
}
function AnglePicture({data,step,hidden}:{data:LearningDataMap["angle"]}&Display) {
  const marker=useId().replace(/:/g,""),theta=toRadians(data.degrees),endX=150+120*Math.cos(theta),endY=150-120*Math.sin(theta);
  const arc=data.degrees===360?"M200 150 A50 50 0 1 0 100 150 A50 50 0 1 0 200 150":`M200 150 A50 50 0 ${data.degrees>180?1:0} 0 ${150+50*Math.cos(theta)} ${150-50*Math.sin(theta)}`;
  return <div className="st-angle-picture"><svg viewBox="0 0 300 300" role="img" aria-label="Transportador de una vuelta completa con giro antihorario señalado">
    <defs><marker id={marker} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="var(--st-piece-secondary)"/></marker></defs>
    <circle cx="150" cy="150" r="120" fill="none" stroke="var(--st-line)"/>
    {Array.from({length:360},(_,i)=>{const t=toRadians(i),r=i%10===0?108:115;return <g key={i}><line x1={150+r*Math.cos(t)} y1={150-r*Math.sin(t)} x2={150+120*Math.cos(t)} y2={150-120*Math.sin(t)} stroke="currentColor" opacity={i%10===0?1:.3}/>{i%30===0&&<text x={150+137*Math.cos(t)} y={155-137*Math.sin(t)} textAnchor="middle" fill="currentColor" fontSize="11">{i}°</text>}</g>;})}
    <line x1="150" y1="150" x2="270" y2="150" stroke="currentColor" strokeWidth="3"/><line x1="150" y1="150" x2={endX} y2={endY} stroke="var(--st-piece-primary)" strokeWidth="4"/>
    {data.degrees>0&&<path d={arc} fill="none" stroke="var(--st-piece-secondary)" strokeWidth="3" markerEnd={`url(#${marker})`}/>}<circle cx="150" cy="150" r="4" fill="currentColor"/>
  </svg><InlineOnly><p className="st-inline-caption">Giro: <InlineValue field="degrees" value={data.degrees} />°</p></InlineOnly>{!hidden&&step>=1&&<Amount label="Giro">{data.degrees}°</Amount>}<p>Empieza en 0° y sigue el arco antihorario. Las marcas pequeñas representan 1°.</p></div>;
}
function CirclePicture({data,step,hidden}:{data:LearningDataMap["circle"]}&Display) {
  const a=circleInfo(data);
  return <div><InlineOnly><p className="st-inline-caption"><InlineValue field="task" value={data.task} /></p></InlineOnly><svg viewBox="0 0 320 300" role="img" aria-label={`Círculo de radio ${data.radius} unidades`}><circle cx="160" cy="140" r="110" fill={data.task==="area"?"var(--st-piece-primary)":"var(--st-piece-empty)"} fillOpacity="0.4" stroke="var(--st-piece-primary)" strokeWidth="4"/><circle cx="160" cy="140" r="4" fill="currentColor"/><line x1="160" y1="140" x2="270" y2="140" stroke="currentColor" strokeWidth="3"/><InlineSvgValue field="radius" value={data.radius} x={210} y={130} width={120} prefix="r = " /><line x1="50" y1="140" x2="160" y2="140" stroke="currentColor" strokeDasharray="5 5"/><text x="160" y="280" textAnchor="middle" fill="currentColor" fontSize="16">Diámetro: {a.diameter} u</text></svg>{!hidden&&step>=2&&<Amount label={data.task==="area"?"Área exacta":"Longitud exacta"}>{a.coefficient}π {a.units}</Amount>}{!hidden&&step>=3&&<p>≈ {a.approximate.toFixed(3)} {a.units}</p>}</div>;
}
function FrequencyBars({bars,label}:{bars:{label:string;count:number}[];label:string}) {
  const height=bars.length*32+20,max=Math.max(1,...bars.map(b=>b.count));
  return <svg viewBox={`0 0 340 ${height}`} role="img" aria-label={label}>{bars.map((b,i)=><g key={b.label}><text x="38" y={i*32+23} textAnchor="end" fill="currentColor" fontSize="14">{b.label}</text><rect x="50" y={i*32+6} height="23" width={b.count/max*230} rx="4" fill="var(--st-piece-primary)"/><text x={56+b.count/max*230} y={i*32+23} fill="currentColor" fontSize="14">{b.count}</text></g>)}</svg>;
}
function StatisticsPicture({data,step,hidden}:{data:LearningDataMap["statistics"]}&Display) {
  const a=statisticsInfo(data);
  return <div><FrequencyBars bars={a.counts.map(c=>({label:String(c.value),count:c.count}))} label="Frecuencias de los valores de la colección"/><InlineOnly><p className="st-inline-caption">Buscar: <InlineValue field="task" value={data.task} /></p></InlineOnly><p>Datos: <InlineValue field="values" value={data.values.join(", ")} />. Cada barra cuenta repeticiones, no suma los valores.</p>{!hidden&&step>=1&&<Amount label="Media exacta">{fractionText(a.mean)}</Amount>}{!hidden&&step>=2&&<Amount label="Mediana">{fractionText(a.median)}</Amount>}{!hidden&&step>=3&&<Amount label="Moda">{a.modes.join(", ")||"sin moda"}</Amount>}</div>;
}
function ProbabilityPicture({data,step,hidden}:{data:LearningDataMap["probability"]}&Display) {
  const a=probabilityInfo(data),labels=Array.from({length:data.outcomes},(_,i)=>data.experiment==="coin"?(i===0?"Cara":"Sello"):String(i+1));
  return <div><InlineOnly><p className="st-inline-caption"><InlineValue field="experiment" value={data.experiment} /> · <InlineValue field="favorable" value={data.favorable} /> favorables de <InlineValue field="outcomes" value={data.outcomes} readOnly={data.experiment !== "spinner"} /> posibles</p><p className="st-inline-caption">Simular <InlineValue field="trials" value={data.trials} /> ensayos · Serie <InlineValue field="seed" value={data.seed} /></p></InlineOnly><div className="st-outcomes" role="img" aria-label={`${data.outcomes} resultados posibles; ${data.favorable} favorables`}>{labels.map((label,i)=><span key={label} className={i<data.favorable?"favorable":""}>{label}</span>)}</div><p>Todos los resultados tienen la misma probabilidad. Los resaltados son favorables.</p>{!hidden&&step>=1&&<Amount label="Probabilidad teórica">{fractionText(a.theoretical)}</Amount>}{(hidden||step>=2)&&<><FrequencyBars bars={a.counts.map((count,i)=>({label:labels[i]!,count}))} label={`Resultados de ${data.trials} ensayos simulados`}/><p>Simulación: {data.trials} ensayos. Sus frecuencias pueden variar.</p></>}</div>;
}
function Tiles({coefficient,constant}:{coefficient:number;constant:number}) {
  return <div className="st-tile-side" role="img" aria-label={`${coefficient} piezas x y ${constant} unidades con signo`}>{Array.from({length:Math.abs(coefficient)},(_,i)=><span key={`x${i}`} className={`st-algebra-x ${coefficient<0?"negative":""}`}>{coefficient<0?"−x":"x"}</span>)}{Array.from({length:Math.abs(constant)},(_,i)=><span key={`u${i}`} className={`st-algebra-unit ${constant<0?"negative":""}`}>{constant<0?"−1":"+1"}</span>)}{!coefficient&&!constant&&<span>0</span>}</div>;
}
function AlgebraPicture({data,step,hidden}:{data:LearningDataMap["algebra-tiles"]}&Display) {
  const a=algebraTilesInfo(data),reduced=!hidden&&step>=1;
  return <div><p className="st-equation-expression"><InlineEquation {...data}>{linearSide(data.a,data.b)} = {linearSide(data.c,data.d)}</InlineEquation></p><div className="st-balance-tiles"><Tiles coefficient={reduced?a.coefficient:data.a} constant={reduced?0:data.b}/><span className="st-tile-equals">=</span><Tiles coefficient={reduced?0:data.c} constant={reduced?a.constant:data.d}/></div><p>Pieza alargada: x. Cuadrado: +1 o −1. El mismo cambio debe aplicarse a ambos miembros.</p>{!hidden&&step>=2&&<Amount label="Solución">{equationResult(a)}</Amount>}</div>;
}
function PowersPicture({data,step,hidden}:{data:LearningDataMap["powers-roots"]}&Display) {
  const a=powersInfo(data),pattern=useId().replace(/:/g,""),layers=data.exponent===3?data.base:1,size=Math.max(1,data.base)*12;
  return <div><InlineOnly><p className="st-inline-caption"><InlineValue field="task" value={data.task} />{data.task === "root" && <> · Índice <InlineValue field="exponent" value={data.exponent} /></>}</p></InlineOnly><p className="st-equation-expression">{data.task==="root"?<>{a.rootSymbol}<InlineValue field="radicand" value={a.power} /></>:<><InlineValue field="base" value={data.base} /><sup><InlineValue field="exponent" value={data.exponent} /></sup></>}</p>{data.base===0?<p>La cantidad es cero: no hay unidades.</p>:<svg viewBox={`0 0 ${Math.min(4,layers)*(size+12)} ${Math.ceil(layers/4)*(data.exponent===1?34:size+24)}`} role="img" aria-label={data.exponent===3?"Capas de cuadrados iguales":data.exponent===2?"Cuadrado con filas y columnas iguales":"Un grupo de unidades"}><defs><pattern id={pattern} width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="var(--st-piece-primary)"/><path d="M0 0H12V12" fill="none" stroke="var(--st-piece-stroke)"/></pattern></defs>{Array.from({length:layers},(_,i)=><rect key={i} x={i%4*(size+12)} y={Math.floor(i/4)*(size+24)} width={size} height={data.exponent===1?12:size} fill={`url(#${pattern})`}/>)}</svg>}<p>{data.exponent===3?"Cada capa tiene filas y columnas iguales. El conjunto representa un cubo.":data.exponent===2?"Cada casilla representa una unidad cuadrada.":"Cada casilla representa una unidad."}</p>{!hidden&&step>=1&&<Amount label={data.task==="root"?"Raíz exacta":"Potencia"}>{a.answer}</Amount>}</div>;
}
function MeasurementPicture({data,step,hidden}:{data:LearningDataMap["measurement"]}&Display) {
  const a=measurementInfo(data);
  return <div className="st-measure-picture"><Amount label="Cantidad inicial"><InlineValue field="value" value={data.value} /> <InlineValue field="from" value={a.from.label} /></Amount><svg viewBox="0 0 300 90" role="img" aria-label="La cantidad se conserva al cambiar la unidad"><rect x="10" y="20" width="280" height="40" rx="6" fill="var(--st-piece-empty)" stroke="var(--st-piece-primary)"/>{Array.from({length:15},(_,i)=><line key={i} x1={10+i*20} x2={10+i*20} y1={20} y2={i%5===0?50:38} stroke="var(--st-piece-primary)"/>)}<text x="150" y="82" textAnchor="middle" fill="currentColor" fontSize="13">Misma cantidad · otra unidad</text></svg><Amount label="Unidad final">{!hidden&&step>=2?fractionText(a.answer):"?"} <InlineValue field="to" value={a.to.label} /></Amount>{!hidden&&step>=1&&<p>Factor: × {fractionText(a.factor)}. El dibujo es esquemático; la relación numérica define la conversión.</p>}</div>;
}
export function LearningMathObject({object,lessonStep=Infinity,concealAnswers=false}:{object:LearningPayload;lessonStep?:number;concealAnswers?:boolean}) {
  const display={step:lessonStep,hidden:concealAnswers};
  return <div className={`st-learning-visual st-learning-${object.type}`}>{(()=>{switch(object.type){
    case "percentage":return <PercentagePicture data={object.data} {...display}/>;
    case "divisibility":return <DivisibilityPicture data={object.data} {...display}/>;
    case "angle":return <AnglePicture data={object.data} {...display}/>;
    case "circle":return <CirclePicture data={object.data} {...display}/>;
    case "statistics":return <StatisticsPicture data={object.data} {...display}/>;
    case "probability":return <ProbabilityPicture data={object.data} {...display}/>;
    case "algebra-tiles":return <AlgebraPicture data={object.data} {...display}/>;
    case "powers-roots":return <PowersPicture data={object.data} {...display}/>;
    case "measurement":return <MeasurementPicture data={object.data} {...display}/>;
  }})()}</div>;
}

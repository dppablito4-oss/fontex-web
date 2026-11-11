import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Circle, GripHorizontal, Layers3, Maximize, Minus, MousePointer2, Plus, RotateCcw, Square, StickyNote, X } from 'lucide-react';
import { parseOperation, type Fraction } from './fractions';
import './canvas.css';

type Position = { x: number; y: number };
type Layout = { first: Position; second: Position; result: Position; note: Position };
const initialLayout: Layout = { first: { x: 76, y: 110 }, second: { x: 486, y: 110 }, result: { x: 282, y: 480 }, note: { x: 870, y: 140 } };
const steps = ['Representar', 'Homogeneizar', 'Resolver'];
const examples = ['2/3 + 3/6', '1/2 + 1/4', '3/4 − 1/6', '5/6 + 2/3'];
function readSaved() {
  try { const value: unknown = JSON.parse(localStorage.getItem('fontex-canvas-v1') || 'null'); if (value && typeof value === 'object' && 'expression' in value && typeof value.expression === 'string') { parseOperation(value.expression); return value.expression; } } catch { /* Start with a valid example if storage is unavailable. */ }
  return examples[0]!;
}
function Frac({ n, d }: Fraction) { return <span className="fc-fraction" aria-label={`${n} sobre ${d}`}><span>{n}</span><span>{d}</span></span>; }
function Pictogram({ n, d, color, shape, original, secondary = 0 }: Fraction & { color: string; shape: string; original?: number; secondary?: number }) {
  const units = Math.max(1, Math.ceil(n / d));
  return <div className={`fc-pictograms ${shape === 'circle' ? 'round' : ''}`} role="img" aria-label={`${n} de ${d} partes por unidad; ${units} figura${units > 1 ? 's' : ''}`}>
    {Array.from({ length: units }, (_, unit) => <svg key={unit} viewBox={shape === 'circle' ? '0 0 120 120' : '0 0 300 78'}>
      {Array.from({ length: d }, (_, i) => {
        const index = unit * d + i;
        const fill = index < n ? (secondary && index >= secondary ? 'var(--fc-coral)' : color) : '#edf0f3';
        if (shape === 'circle') {
          const angle = 2 * Math.PI / d, start = i * angle - Math.PI / 2, end = start + angle;
          return d === 1 ? <circle key={i} cx="60" cy="60" r="54" fill={fill} stroke="white" strokeWidth="2" /> : <path key={i} d={`M60 60 L${60 + 54 * Math.cos(start)} ${60 + 54 * Math.sin(start)} A54 54 0 ${angle > Math.PI ? 1 : 0} 1 ${60 + 54 * Math.cos(end)} ${60 + 54 * Math.sin(end)} Z`} fill={fill} stroke="white" strokeWidth="1.8" />;
        }
        return <rect key={i} x={i * 300 / d} y="0" width={300 / d} height="78" fill={fill} stroke="white" strokeWidth="2" />;
      })}
      {original && shape !== 'circle' && Array.from({ length: original - 1 }, (_, i) => <line key={i} x1={(i + 1) * 300 / original} x2={(i + 1) * 300 / original} y1="0" y2="78" stroke="#344054" strokeWidth="2" strokeDasharray="4 4" />)}
    </svg>)}
  </div>;
}
export function FractionCanvas() {
  const [expression, setExpression] = useState(readSaved);
  const [operation, setOperation] = useState(() => parseOperation(expression));
  const [stage, setStage] = useState(0);
  const [shape, setShape] = useState('bar');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(() => window.innerWidth <= 760 ? .65 : 1);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: keyof Layout; x: number; y: number; origin: Position } | null>(null);
  useEffect(() => {
    const view = viewport.current;
    const card = view?.querySelector('.fc-result');
    const rect = card?.getBoundingClientRect();
    const bounds = view?.getBoundingClientRect();
    view?.scrollTo?.({ top: stage === 2 && rect && bounds ? view.scrollTop + rect.top - bounds.top - 24 : 0, left: stage === 2 && rect && bounds ? Math.max(0, view.scrollLeft + rect.left - bounds.left - 24) : 0, behavior: 'instant' });
  }, [stage]);
  const op = operation;
  function visualize(value = expression) {
    try { const next = parseOperation(value); setOperation(next); setExpression(value); setError(''); setStage(0); setSaved(false); try { localStorage.setItem('fontex-canvas-v1', JSON.stringify({ expression: value })); setSaved(true); } catch { /* Drawing works without browser storage. */ } } catch (e) { setError((e as Error).message); }
  }
  function startDrag(event: PointerEvent, key: keyof Layout) { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { key, x: event.clientX, y: event.clientY, origin: layout[key] }; }
  function moveDrag(event: PointerEvent) { const active = drag.current; if (!active) return; const position = { x: Math.max(12, Math.min(1100, active.origin.x + (event.clientX - active.x) / zoom)), y: Math.max(16, Math.min(850, active.origin.y + (event.clientY - active.y) / zoom)) }; setLayout(current => ({ ...current, [active.key]: position })); }
  const position = (key: keyof Layout): CSSProperties => ({ left: layout[key].x, top: layout[key].y });
  const handle = (key: keyof Layout, title: string) => <div className="fc-card-handle" onPointerDown={event => startDrag(event, key)} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><span>{title}</span><GripHorizontal size={18} aria-hidden="true" /></div>;
  const common = stage > 0;
  const explanation = [
    <>Cada figura completa vale <strong>una unidad</strong>. La primera se divide en {op.a.d} partes iguales y coloreamos {op.a.n}; la segunda, en {op.b.d} partes y coloreamos {op.b.n}. {op.a.d !== op.b.d ? 'Las piezas tienen tamaños distintos: necesitamos una medida común.' : 'Las piezas ya tienen el mismo tamaño: sus denominadores son iguales.'}</>,
    <>Homogeneizar significa <strong>expresar las fracciones con el mismo denominador</strong>. El mínimo común múltiplo de {op.a.d} y {op.b.d} es <strong>{op.denominator}</strong>. Dividimos cada unidad en {op.denominator} partes iguales sin cambiar la cantidad coloreada.</>,
    <>Ahora cada pieza representa <strong>1/{op.denominator}</strong> de la misma unidad. {op.operator === '+' ? 'Reunimos' : 'Quitamos'} las piezas: {op.left} {op.operator} {op.right} = <strong>{op.total}</strong>. Conservamos el denominador porque el tamaño de las piezas sigue siendo el mismo.</>,
  ];
  return <div className="fc-app">
    <header className="fc-header"><a href="#/" className="fc-brand"><span className="fc-brand-icon"><Layers3 size={22}/></span>fontex<span className="fc-brand-divider"/><span className="fc-brand-sub">Laboratorio visual</span></a><div className="fc-header-right"><span className="fc-save"><span/>{saved ? 'Operación guardada' : 'Tu espacio para explorar'}</span><button className="fc-reset" onClick={() => { setLayout(initialLayout); setZoom(1); setStage(0); setNote(null); viewport.current?.scrollTo(0, 0); }}><RotateCcw size={15}/> Reiniciar vista</button></div></header>
    <div className="fc-body"><aside className="fc-sidebar"><div className="fc-eyebrow">MATEMÁTICA, A LA VISTA</div><h1>Las fracciones <br/>toman forma<span>.</span></h1><p className="fc-intro">Escribe una operación y descubre qué pasa en cada paso.</p>
      <form onSubmit={event => { event.preventDefault(); visualize(); }}><label htmlFor="fc-expression">Tu operación</label><div className={`fc-input ${error ? 'invalid' : ''}`}><input id="fc-expression" value={expression} onChange={event => { setExpression(event.target.value); setSaved(false); }} spellCheck={false} autoComplete="off" aria-describedby={error ? 'fc-error' : 'fc-help'}/><span>↵</span></div><p id="fc-help" className="fc-help">Suma o resta dos fracciones: a/b + c/d</p>{error && <p id="fc-error" role="alert" className="fc-error">{error}</p>}<button type="submit" className="fc-primary">Visualizar operación <ArrowRight size={17}/></button></form>
      <div className="fc-examples"><span>PRUEBA TAMBIÉN</span><div>{examples.filter(value => value !== examples[0]).map(value => <button key={value} onClick={() => visualize(value)}>{value}</button>)}</div></div>
      <div className="fc-sidebar-separator"/><div className="fc-section-label">UNA IDEA, TRES PASOS</div><nav aria-label="Pasos de la operación" className="fc-steps">{steps.map((title, i) => <button key={title} aria-current={stage === i ? 'step' : undefined} onClick={() => setStage(i)}><span className="fc-step-number">{stage > i ? <Check size={15}/> : `0${i + 1}`}</span><span><strong>{title}</strong><small>{['Conocer las partes', 'Darles el mismo tamaño', op.operator === '+' ? 'Reunir y simplificar' : 'Restar y simplificar'][i]}</small></span>{stage === i && <span className="fc-step-dot"/>}</button>)}</nav>
      <div className="fc-sidebar-footer"><span className="fc-mini-icon">✦</span><p>Entender primero.<br/><strong>Las fórmulas vienen después.</strong></p></div>
    </aside><main className="fc-workspace"><div className="fc-canvas-top"><div><span className="fc-live-dot"/> Lienzo de fracciones <span className="fc-beta">PROTOTIPO</span></div><span className="fc-canvas-hint">Mueve las tarjetas desde su encabezado</span></div>
      <div className="fc-viewport" ref={viewport}><div className="fc-world" style={{ width: 1480 * zoom, height: 1180 * zoom }}><div className="fc-scaled" style={{ transform: `scale(${zoom})` }}>
        <div className="fc-board-heading"><span>EXPERIMENTO 01</span><h2>{common ? stage === 2 ? 'El mismo tamaño. Una nueva cantidad.' : 'Distintas partes, la misma cantidad.' : 'Todo empieza con una unidad.'}</h2></div>
        <article className="fc-math-card fc-first" style={position('first')}>{handle('first', 'PRIMERA FRACCIÓN')}<div className="fc-card-content"><div className="fc-value"><Frac n={op.a.n} d={op.a.d}/>{common && <><span className="fc-equivalence">=</span><Frac n={op.left} d={op.denominator}/><span className="fc-multiplier">× {op.denominator / op.a.d}<small>arriba y abajo</small></span></>}</div><Pictogram n={common ? op.left : op.a.n} d={common ? op.denominator : op.a.d} color="var(--fc-teal)" shape={shape} original={common ? op.a.d : undefined}/><p>{common ? `${op.left} partes de 1/${op.denominator}` : `${op.a.n} partes de 1/${op.a.d}`} <span>de la unidad</span></p>{common && <div className="fc-conversion">{op.denominator / op.a.d === 1 ? 'Ya tiene el denominador común.' : `Cada parte se divide en ${op.denominator / op.a.d}. La cantidad no cambia.`}</div>}</div></article>
        <div className="fc-board-operator" style={{ left: (layout.first.x + 366 + layout.second.x) / 2 - 18, top: layout.first.y + 110 }}>{op.operator === '+' ? '+' : '−'}</div>
        <article className="fc-math-card fc-second" style={position('second')}>{handle('second', 'SEGUNDA FRACCIÓN')}<div className="fc-card-content"><div className="fc-value"><Frac n={op.b.n} d={op.b.d}/>{common && <><span className="fc-equivalence">=</span><Frac n={op.right} d={op.denominator}/><span className="fc-multiplier">× {op.denominator / op.b.d}<small>arriba y abajo</small></span></>}</div><Pictogram n={common ? op.right : op.b.n} d={common ? op.denominator : op.b.d} color="var(--fc-coral)" shape={shape} original={common ? op.b.d : undefined}/><p>{common ? `${op.right} partes de 1/${op.denominator}` : `${op.b.n} partes de 1/${op.b.d}`} <span>de la unidad</span></p>{common && <div className="fc-conversion">{op.denominator / op.b.d === 1 ? 'Ya tiene el denominador común.' : `Cada parte se divide en ${op.denominator / op.b.d}. La cantidad no cambia.`}</div>}</div></article>
        {stage < 2 ? <div className="fc-board-insight"><span>✦</span><p>{common ? <>El área coloreada se conserva.<br/><strong>Solo cambia cómo la dividimos.</strong></> : <>Misma unidad, distintas divisiones.<br/><strong>¿Cómo hacemos que las piezas sean iguales?</strong></>}</p></div> : <article className="fc-math-card fc-result" style={position('result')}>{handle('result', 'ASÍ QUEDA EL RESULTADO')}<div className="fc-card-content"><div className="fc-result-equation"><Frac n={op.left} d={op.denominator}/><span>{op.operator === '+' ? '+' : '−'}</span><Frac n={op.right} d={op.denominator}/><span>=</span><Frac n={op.total} d={op.denominator}/></div><Pictogram n={op.total} d={op.denominator} color="var(--fc-teal)" shape={shape} secondary={op.operator === '+' ? op.left : 0}/><p>{op.total} piezas del mismo tamaño</p><div className="fc-result-answer"><Check size={18}/><span>{op.total}/{op.denominator}{op.simplified.d !== op.denominator ? ` = ${op.simplified.n}/${op.simplified.d}` : ''}{op.total >= op.denominator ? ` = ${Math.floor(op.total / op.denominator)}${op.total % op.denominator ? ` y ${op.simplified.n % op.simplified.d}/${op.simplified.d}` : ''}` : ''}</span></div></div></article>}
        {note !== null && <article className="fc-note" style={position('note')}>{handle('note', 'MI OBSERVACIÓN')}<button aria-label="Eliminar nota" onClick={() => setNote(null)}><X size={15}/></button><textarea aria-label="Mi observación" placeholder="¿Qué descubriste?" value={note} onChange={event => setNote(event.target.value)}/></article>}
      </div></div></div>
      <div className="fc-toolbar"><div className="fc-tools"><span className="fc-active-tool" title="Mover tarjetas"><MousePointer2 size={18}/></span><span className="fc-tool-divider"/><button aria-label="Mostrar barras" aria-pressed={shape === 'bar'} onClick={() => setShape('bar')}><Square size={18}/></button><button aria-label="Mostrar círculos" aria-pressed={shape === 'circle'} onClick={() => setShape('circle')}><Circle size={18}/></button><button aria-label="Añadir nota" onClick={() => setNote(current => current ?? '')}><StickyNote size={18}/></button></div><div className="fc-zoom"><button aria-label="Alejar" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, value - .1))}><Minus size={15}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Acercar" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + .1))}><Plus size={15}/></button><span className="fc-tool-divider"/><button aria-label="Ajustar lienzo" onClick={() => { setZoom(Math.min(1, Math.max(.5, ((viewport.current?.clientWidth || 1000) - 30) / 900))); viewport.current?.scrollTo(0, 0); }}><Maximize size={16}/></button></div></div>
      <section className="fc-explanation" aria-live="polite"><div className="fc-explanation-heading"><span className="fc-section-label">LO QUE ESTÁ PASANDO</span><span className="fc-stage-count">PASO {stage + 1} DE 3 <ChevronDown size={13}/></span></div><div className="fc-explanation-body"><div><h3>{['Leer el dibujo', 'Homogeneizar no cambia el valor', op.operator === '+' ? 'Sumar las piezas, conservar su tamaño' : 'Restar las piezas, conservar su tamaño'][stage]}</h3><p>{explanation[stage]}</p>{common && <div className="fc-mcm">m.c.m.({op.a.d}, {op.b.d}) = {op.denominator}<span>Una medida común para ambas figuras</span></div>}</div><div className="fc-next-step"><span>{stage === 2 ? '¡Ya puedes probar otra operación!' : stage === 0 ? 'Ahora, busquemos piezas iguales' : 'Todo listo para operar'}</span><div><button className="fc-back" aria-label="Paso anterior" disabled={stage === 0} onClick={() => setStage(value => value - 1)}><ArrowLeft size={18}/></button><button className="fc-primary" onClick={() => setStage(stage === 2 ? 0 : stage + 1)}>{['Homogeneizar', 'Ver resultado', 'Volver al inicio'][stage]}<ArrowRight size={17}/></button></div></div></div></section>
    </main></div>
  </div>;
}

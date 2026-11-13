import { useMemo, useState, useRef, useEffect, useId } from "react";
import { SiteHeader } from "../../components/ProductNavigation";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../../lib/supabase/client";
import { derivative, evaluate, expressionText, parseExpression, polynomial, realRoots, type Expr, type Variables } from "../../core/scene/expression";
import { expressionScene, parseScene, type Scene } from "../../core/scene/document";
import "./general-canvas.css";
const number = (n: number) => Number.isFinite(n) ? String(Number(n.toPrecision(7))) : "No definido";
function Graph({ expression, derived, variables, span, tangent, showDerivative }: { expression: Expr; derived: Expr; variables: Variables; span: number; tangent: number; showDerivative: boolean }) {
  const clipId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [displayWidth, setDisplayWidth] = useState(800);
  useEffect(() => { const node = svg.current; if (!node) return; const observer = new ResizeObserver(() => setDisplayWidth(node.getBoundingClientRect().width || 800)); observer.observe(node); return () => observer.disconnect(); }, []);
  const fontSize = Math.max(15, Math.min(30, 11 * 800 / displayWidth));
  const width = 800, height = 440, margin = 60;
  const px = (x: number) => margin + (x + span) / (2 * span) * (width - margin * 2);
  const py = (y: number) => height - margin - (y + span) / (2 * span) * (height - margin * 2);
  function path(expr: Expr) {
    let out = "", previous: number | null = null;
    for (let i = 0; i <= 600; i++) {
      const x = -span + i / 600 * span * 2, y = evaluate(expr, x, variables);
      const domain = evaluate(expression, x, variables);
      if (!Number.isFinite(y) || !Number.isFinite(domain) || Math.abs(y) > span * 1.1) { previous = null; continue; }
      const midpoint = previous === null ? NaN : evaluate(expr, x - span / 600, variables);
      const jump = previous !== null && (Math.abs(y - previous) > span / 2 || !Number.isFinite(midpoint) || Math.abs(midpoint) > span * 1.1);
      out += `${previous === null || jump ? "M" : "L"}${px(x).toFixed(2)},${py(y).toFixed(2)} `; previous = y;
    }
    return out;
  }
  const y = evaluate(expression, tangent, variables), slope = evaluate(derived, tangent, variables);
  const ticks = Array.from({ length: 9 }, (_, i) => -span + i * span / 4);
  return <svg ref={svg} className="gc-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico cartesiano de la expresión y su derivada; los segmentos fuera del dominio no se dibujan">
    <defs><clipPath id={clipId}><rect x={margin} y={margin} width={width - margin * 2} height={height - margin * 2} /></clipPath></defs>
    {ticks.map(t => <g key={t}><path d={`M${px(t)},${margin}V${height - margin}M${margin},${py(t)}H${width - margin}`} stroke="var(--gc-line)" strokeWidth="1" /><text x={px(t)} y={height - 12} textAnchor="middle" fill="currentColor" fontSize={fontSize}>{number(t)}</text><text x={margin - 10} y={py(t) + 5} textAnchor="end" fill="currentColor" fontSize={fontSize}>{number(t)}</text></g>)}
    <path d={`M${margin},${py(0)}H${width - margin}M${px(0)},${margin}V${height - margin}`} stroke="currentColor" strokeWidth="1.5" />
    <g clipPath={`url(#${clipId})`}><path d={path(expression)} fill="none" stroke="var(--gc-accent)" strokeWidth="3" />{showDerivative && <path d={path(derived)} fill="none" stroke="#edaf65" strokeWidth="2.5" strokeDasharray="7 4" />}
    {Number.isFinite(y) && Number.isFinite(slope) && <><path d={`M${px(-span)},${py(y + slope * (-span - tangent))}L${px(span)},${py(y + slope * (span - tangent))}`} stroke="#c69cff" strokeWidth="2" /><circle cx={px(tangent)} cy={py(y)} r="5" fill="currentColor" /></>}</g>
  </svg>;
}
function ExpressionView({ source, kind, variables, span, tangent, showDerivative }: { source: string; kind: "plot" | "formula" | "table"; variables: Variables; span: number; tangent: number; showDerivative: boolean }) {
  const analysis = useMemo(() => {
    try { const expression = parseExpression(source), derived = derivative(expression), coefficients = polynomial(expression, variables); return { expression, derived, coefficients, roots: coefficients ? realRoots(coefficients) : null }; }
    catch (e) { return { error: e instanceof Error ? e.message : "No se pudo calcular." }; }
  }, [source, variables]);
  if (analysis.error || !analysis.expression || !analysis.derived) return <p role="alert">{analysis.error}</p>;
  const { expression, derived, coefficients, roots } = analysis;
  if (kind === "plot") return <><Graph {...{ expression, derived, variables, span, tangent, showDerivative }} /><p className="gc-legend"><span>━ Función</span><span>┄ Derivada</span><span>━ Tangente en x = {number(tangent)}</span></p><small>Trigonometría en radianes. La ventana muestra x e y entre −{span} y {span}; los trazos se muestrean numéricamente.</small></>;
  if (kind === "table") return <details><summary>Tabla de valores vinculada</summary><table><thead><tr><th>x</th><th>f(x)</th><th>f′(x)</th></tr></thead><tbody>{[-2, -1, 0, 1, 2].map(x => <tr key={x}><td>{x}</td><td>{number(evaluate(expression, x, variables))}</td><td>{Number.isFinite(evaluate(expression, x, variables)) ? number(evaluate(derived, x, variables)) : "No definido"}</td></tr>)}</tbody></table></details>;
  return <><p className="gc-formula">{source.includes("=") ? "Residuo de la ecuación" : "f(x)"} = {expressionText(expression)}</p><p className="gc-formula">f′(x) = {expressionText(derived)}</p><p>En x = {number(tangent)}: f(x) = <strong>{number(evaluate(expression, tangent, variables))}</strong>; pendiente = <strong>{Number.isFinite(evaluate(expression, tangent, variables)) ? number(evaluate(derived, tangent, variables)) : "No definida"}</strong>.</p>
    {coefficients && <div className="gc-results"><strong>{coefficients.length > 1 ? `Polinomio de grado ${coefficients.length - 1}` : "Expresión constante"}</strong><p>{coefficients.length === 1 ? coefficients[0] === 0 ? "La igualdad se cumple para todos los valores reales de x." : "La expresión constante no tiene ceros." : roots?.length ? `Soluciones reales aproximadas de f(x) = 0: ${roots.map(number).join("; ")}` : "No hay soluciones reales."}</p><small>Se calculan raíces reales hasta grado 4, incluidas raíces repetidas. Las soluciones complejas no se calculan todavía.</small></div>}
    <details><summary>Cómo se calcula la derivada</summary><p>Se analiza la expresión como un árbol matemático. Se aplican reglas de suma, producto, cociente, potencia y cadena; sin/cos/tan usan radianes. Los parámetros a, b y c se tratan como constantes. El gráfico y la tabla usan esa misma derivada, sin nuevas consultas a IA.</p></details></>;
}
export function GeneralCanvas() {
  const { user } = useAuth(); const owner = user?.id ?? "guest"; return <Canvas key={owner} owner={owner} authenticated={!!user} />;
}
function Canvas({ owner, authenticated }: { owner: string; authenticated: boolean }) {
  const key = `fontex-general-prototype:${owner}`;
  const [scene, setScene] = useState<Scene>(() => { try { const raw = localStorage.getItem(key); return raw ? parseScene(JSON.parse(raw) as unknown) : expressionScene("a*x^2 + b*x + c"); } catch { return expressionScene("a*x^2 + b*x + c"); } });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const variables = scene.parameters;
  const setVariables = (change: (previous: Variables) => Variables) => setScene(s => ({ ...s, parameters: change(s.parameters) }));
  const [span, setSpan] = useState(5), [tangent, setTangent] = useState(1), [showDerivative, setShowDerivative] = useState(true);
  const [prompt, setPrompt] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(true);
  const [history, setHistory] = useState<Scene[]>([]); const file = useRef<HTMLInputElement>(null); const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify(scene)); setSaved(true); } catch { setSaved(false); } }, 150); return () => clearTimeout(timer); }, [scene, key]);
  function replace(next: Scene) { setHistory(h => [...h.slice(-19), scene]); setScene(next); setDrafts({}); setError(""); }
  function changeExpression(id: string, source: string) {
    setDrafts(d => ({ ...d, [id]: source }));
    try { parseExpression(source); setScene(s => ({ ...s, expressions: s.expressions.map(e => e.id === id ? { ...e, source } : e) })); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Revisa la expresión."); }
  }
  async function build() {
    if (!prompt.trim() || busy) return;
    try { replace(expressionScene(prompt.trim().replace(/^(?:derivada de|deriva|grafica|gráfica de|dibuja|función|funcion)\s+/i, ""))); setPrompt(""); return; } catch { /* Descriptive requests go through the scene generator. */ }
    if (!authenticated || !supabase) { setError("Para describir una escena con IA, inicia sesión. Puedes explorar sin cuenta escribiendo una expresión, por ejemplo sin(x) o x^3-x=0."); return; }
    setBusy(true); setError("");
    try { const result = await supabase.functions.invoke<unknown>("scene-agent", { body: { question: prompt.trim() }, timeout: 55000 }); if (result.error) throw new Error("No se pudo construir la escena. Prueba de nuevo o escribe directamente una expresión."); replace(parseScene(result.data)); setPrompt(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo construir."); } finally { setBusy(false); }
  }
  function download() { const url = URL.createObjectURL(new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "fontex-escena.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return <div className="gc-app" ref={root}><SiteHeader /><header className="gc-header"><div><small>FONTEX · LIENZO GENERAL · PROTOTIPO</small><h1>{scene.title}</h1><p>Una expresión. Gráficos, derivadas y resultados que cambian contigo.</p></div><a href="#/lienzo">Volver a mis materiales</a></header>
    <section className="gc-composer"><label htmlFor="gc-prompt">¿Qué quieres explorar?</label><form onSubmit={e => { e.preventDefault(); void build(); }}><input id="gc-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1200} placeholder="Escribe sin(x), x^4 − 5*x^2 + 4 = 0, o describe tu idea" /><button disabled={busy || !prompt.trim()}>{busy ? "Construyendo…" : "Construir"}</button></form><div className="gc-examples">{["sin(x)", "sin(2*x)+cos(x)", "x^2-5*x+6=0", "x^3-6*x^2+11*x-6=0", "x^4-5*x^2+4=0", "ln(x)", "exp(x)"].map(source => <button key={source} onClick={() => replace(expressionScene(source))}>{source}</button>)}</div></section>
    {error && <p className="gc-error" role="alert">{error}</p>}
    <div className="gc-toolbar"><button onClick={() => { const previous = history.at(-1); if (previous) { setScene(previous); setHistory(h => h.slice(0, -1)); setDrafts({}); } }} disabled={!history.length}>Deshacer escena</button><button disabled={scene.elements.length >= 32} onClick={() => replace({ ...scene, elements: [...scene.elements, { id: crypto.randomUUID(), kind: "text", text: "Escribe tu explicación aquí." }] })}>Añadir texto</button><button onClick={() => { let index = 1; while (scene.expressions.some(e => e.id === `f${index}`)) index++; const id = `f${index}`; if (scene.expressions.length >= 8 || scene.elements.length > 30) { setError("El prototipo admite hasta ocho expresiones por escena."); return; } replace({ ...scene, expressions: [...scene.expressions, { id, source: "sin(x)" }], elements: [...scene.elements, { id: crypto.randomUUID(), kind: "formula", expressionId: id }, { id: crypto.randomUUID(), kind: "plot", expressionId: id }] }); }}>Añadir expresión</button><button onClick={download}>Exportar escena</button><button onClick={() => file.current?.click()}>Abrir escena</button><button onClick={() => window.print()}>Imprimir / PDF</button><small>{saved ? "Guardado en este dispositivo" : "No se pudo guardar: exporta una copia"}</small><input ref={file} type="file" accept="application/json,.json" hidden onChange={event => { const target = event.target, selected = target.files?.[0]; if (selected) { if (selected.size > 300000) { setError("El archivo supera los 300 KB."); target.value = ""; return; } void selected.text().then(text => replace(parseScene(JSON.parse(text) as unknown))).catch(() => setError("El archivo no es una escena válida.")).finally(() => { target.value = ""; }); } }} /></div>
    <main className="gc-workspace"><aside className="gc-controls"><h2>Variables compartidas</h2>{(["a", "b", "c"] as const).map(name => <label key={name}>{name} = {number(variables[name])}<input aria-label={`Parámetro ${name}`} type="range" min="-5" max="5" step="0.1" value={variables[name]} onChange={e => setVariables(v => ({ ...v, [name]: Number(e.target.value) }))} /></label>)}<label>Punto de tangencia x₀<input aria-label="Punto de tangencia" type="number" min={-span} max={span} step="0.1" value={tangent} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setTangent(n); }} /></label><label>Ventana del gráfico<select value={span} onChange={e => setSpan(Number(e.target.value))}>{[2, 5, 10, 20].map(n => <option key={n} value={n}>−{n} a {n}</option>)}</select></label><label className="gc-check"><input type="checkbox" checked={showDerivative} onChange={e => setShowDerivative(e.target.checked)} />Mostrar derivada</label><p>Las expresiones y los elementos están vinculados por identificadores. No hay un catálogo de módulos por tema.</p></aside>
    <div className="gc-paper"><section className="gc-expressions"><h2>Expresiones de la escena</h2>{scene.expressions.map(e => <label key={e.id}>{e.id}(x)<input aria-label={`Expresión ${e.id}`} value={drafts[e.id] ?? e.source} onChange={event => changeExpression(e.id, event.target.value)} spellCheck={false} /></label>)}</section>
    {scene.elements.map(element => <section className={`gc-element gc-node-${element.kind}`} key={element.id}>{element.kind === "text" ? <><div className="gc-print-text">{element.text}</div><textarea aria-label="Texto de la escena" value={element.text} onChange={e => setScene(s => ({ ...s, elements: s.elements.map(item => item.id === element.id ? { ...element, text: e.target.value.slice(0, 5000) } : item) }))} /></> : <ExpressionView source={scene.expressions.find(e => e.id === element.expressionId)!.source} kind={element.kind} {...{ variables, span, tangent, showDerivative }} />}</section>)}
    </div></main><footer className="gc-footer">Primera versión: expresiones de una variable, trigonometría en radianes, derivación simbólica y raíces reales de polinomios hasta grado 4. La IA propone; el motor calcula. Verifica las aproximaciones numéricas.</footer></div>;
}

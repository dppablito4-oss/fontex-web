import { useEffect, useId, useState } from "react";
import { MousePointer2, Pause, Play, RotateCcw } from "lucide-react";

export function ParabolaHero() {
  const [a, setA] = useState(0.5);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const id = useId().replace(/:/g, "");
  const halfWidth = 40 * Math.sqrt(5.5 / a);
  const curve = `M ${220 - halfWidth} 40 Q 220 480 ${220 + halfWidth} 40`;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return <div className="lp-demo-wrap lp-parabola" data-playing={playing && !reducedMotion}>
    <div className="lp-demo-tag"><span />Una idea que cobra movimiento</div>
    <div className="lp-demo-window">
      <div className="lp-window-bar"><span className="lp-window-dots" aria-hidden="true"><i /><i /><i /></span><span>Explora una parábola</span><div className="lp-parabola-actions"><button type="button" aria-label={playing ? "Pausar animación" : "Reanudar animación"} disabled={reducedMotion} title={reducedMotion ? "Movimiento reducido activado" : playing ? "Pausar animación" : "Reanudar animación"} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" aria-label="Restablecer ejemplo" title="Restablecer ejemplo" onClick={() => { setA(0.5); setPlaying(true); }}><RotateCcw size={15} /></button></div></div>
      <div className="lp-parabola-formula" aria-label={`Función y = ${a} x al cuadrado`}><span>ƒ(x)</span><strong>y = <output htmlFor={`${id}-a`}>{a.toLocaleString("es-PE")}</output>x²</strong><span className="lp-parabola-badge">FUNCIÓN CUADRÁTICA</span></div>
      <svg className="lp-parabola-graph" viewBox="0 0 440 315" role="img" aria-label={`Parábola y = ${a} x al cuadrado, con vértice en el origen`}>
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".02" /><stop offset="100%" stopColor="currentColor" stopOpacity=".14" /></linearGradient><pattern id={`${id}-grid`} width="40" height="40" x="20" y="20" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" className="lp-graph-grid" /></pattern></defs>
        <rect x="20" y="20" width="400" height="280" fill={`url(#${id}-grid)`} />
        <path className="lp-graph-axis" d="M30 260H410 M220 295V20 M404 256L410 260L404 264 M216 26L220 20L224 26" />
        <g className="lp-graph-labels" aria-hidden="true">{[-4, -2, 2, 4].map(x => <text key={x} x={220 + x * 40} y="279" textAnchor="middle">{x}</text>)}{[2, 4].map(y => <text key={y} x="208" y={264 - y * 40} textAnchor="end">{y}</text>)}<text x="206" y="279">0</text><text x="410" y="249">x</text><text x="232" y="25">y</text></g>
        <path d={`${curve} L ${220 + halfWidth} 260 H ${220 - halfWidth} Z`} fill={`url(#${id}-fill)`} />
        <path key={`curve-${a}`} className="lp-parabola-curve" d={curve} pathLength="1" />
        <circle className="lp-parabola-vertex" cx="220" cy="260" r="4" />
        <g key={`point-${a}`} aria-hidden="true" className="lp-parabola-point" style={{ offsetPath: `path("${curve}")`, offsetRotate: "0deg" }}><circle r="13" className="lp-parabola-halo" /><circle r="5" /></g>
        <g className="lp-graph-origin" aria-hidden="true"><path d="M227 266L281 296" /><rect x="276" y="283" width="110" height="28" rx="7" /><text x="331" y="301" textAnchor="middle">Vértice (0, 0)</text></g>
      </svg>
      <label className="lp-parabola-control" htmlFor={`${id}-a`}><span>Apertura de la curva</span><input id={`${id}-a`} aria-label="Apertura de la parábola" type="range" min="0.5" max="1.5" step="0.25" value={a} onChange={event => setA(Number(event.target.value))} /><span className="lp-parabola-coefficient">a = {a.toLocaleString("es-PE")}</span></label>
      <div className="lp-demo-note"><MousePointer2 size={16} /><p>Mueve el control y explora la curva.<br /><strong>Una fórmula. Infinitas formas de entenderla.</strong></p></div>
    </div>
    <div className="lp-example-note"><span aria-hidden="true">↳</span> Así se aprende en Fontex: probando.</div>
  </div>;
}

import { ArrowRight, Grid2X2, Shapes, Sparkles, Type } from "lucide-react";
import type { ObjectType } from "../../core/document-schema/document";

export function CanvasWelcome({ onAdd, onBrowse }: { onAdd?: (type: ObjectType) => void; onBrowse?: () => void }) {
  return <section className="st-canvas-welcome" aria-labelledby="st-welcome-title" onClick={event => event.stopPropagation()}>
    <div className="st-welcome-art" aria-hidden="true">
      <div className="st-welcome-orbit" />
      <span className="st-welcome-spark"><Sparkles size={21} /></span>
      <div className="st-welcome-fraction"><span>3<span />4</span><div>{[0, 1, 2, 3].map(i => <i className={i < 3 ? "filled" : ""} key={i} />)}</div></div>
      <div className="st-welcome-shape"><svg viewBox="0 0 100 80"><path d="M15 65L50 10L85 65Z" /><path d="M15 65H85M50 10V65" /></svg><span>Un mundo de formas</span></div>
      <div className="st-welcome-pattern"><i /><i /><i /><span>2, 4, 6…</span></div>
    </div>
    <p className="st-welcome-eyebrow">UN LIENZO. MUCHAS POSIBILIDADES.</p>
    <h2 id="st-welcome-title">Dale vida a una idea.</h2>
    <p className="st-welcome-copy">Empieza con algo sencillo. Cambia sus valores<br className="st-welcome-break" /> y descubre lo que pasa.</p>
    {onAdd && <div className="st-welcome-starters" aria-label="Empezar un material">
      <button onClick={() => onAdd("fraction")}><span className="st-welcome-icon mint"><Grid2X2 size={19} /></span><span><strong>Explorar fracciones</strong><small>Ver las partes de un todo</small></span><ArrowRight size={16} /></button>
      <button onClick={() => onAdd("geometry")}><span className="st-welcome-icon blue"><Shapes size={19} /></span><span><strong>Crear geometría</strong><small>Descubrir formas y medidas</small></span><ArrowRight size={16} /></button>
      <button onClick={() => onAdd("text")}><span className="st-welcome-icon lilac"><Type size={19} /></span><span><strong>Escribir una explicación</strong><small>Dar contexto a tu material</small></span><ArrowRight size={16} /></button>
    </div>}
    {onBrowse && <button className="st-welcome-browse" onClick={onBrowse}>Ver todos los módulos<ArrowRight size={14} /></button>}
    <p className="st-welcome-tip">A tu ritmo. Puedes deshacer cualquier cambio.</p>
  </section>;
}

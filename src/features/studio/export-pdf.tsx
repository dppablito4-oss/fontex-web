import { renderToStaticMarkup } from "react-dom/server";
import type { StudioDocument } from "../../core/document-schema/document";
import type { AgentLevel } from "../../core/agent/protocol";
import { ObjectVisual } from "./MathObjectRenderer";
import { lessonSteps } from "./lesson-steps";
import printStyles from "./print.css?inline";
import { TeachingLevel } from "./teaching-level";

export function printableMaterial(doc: StudioDocument, level: AgentLevel) {
  return renderToStaticMarkup(
    <TeachingLevel.Provider value={level}>
      <div className="st-app st-print-document">
        <header className="st-print-header">
          <div className="st-print-brand"><img src={`${import.meta.env.BASE_URL}brand/fontex-mark.svg`} alt="Logo de Fontex" width={38} height={38} /><span>fontex</span></div>
          <h1>{doc.title}</h1>
        </header>
        <main>{[...doc.objects].sort((a, b) => a.y - b.y || a.x - b.x).map(object => {
          const steps = lessonSteps(object, level);
          return <section className="st-print-object" key={object.id}>
            <h2>{object.label}</h2>
            {object.type === "text"
              ? <div className="st-print-text">{object.data.content.split(/\r?\n/).filter(line => line.trim()).map((line, index) => <p key={index}>{line}</p>)}</div>
              : <div className="st-print-visual"><ObjectVisual object={object.type === "operation" ? { ...object, data: { ...object.data, stage: 2 } } : object.type === "linear-equation" ? { ...object, data: { ...object.data, stage: 2 } } : object} onChange={() => {}} lessonStep={Infinity} /></div>}
            {steps.length > 0 && <ol className="st-print-steps">{steps.map(([title, text], index) => <li key={index}><strong>{title}</strong><p>{text}</p></li>)}</ol>}
          </section>;
        })}</main>
      </div>
    </TeachingLevel.Provider>,
  );
}

export function printablePage(doc: StudioDocument, level: AgentLevel, appStyles: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">${renderToStaticMarkup(<title>{doc.title}</title>)}${appStyles}<style>${printStyles}</style></head><body>${printableMaterial(doc, level)}</body></html>`;
}

/** Print a separate, fully expanded document: zoom, scroll and card sizes never crop it. */
export async function exportPDF(doc: StudioDocument, level: AgentLevel) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Exportar material a PDF");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;height:800px;border:0";
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(node => node.outerHTML).join("\n");
  document.body.append(frame);
  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error("No se pudo preparar el PDF."));
      frame.srcdoc = printablePage(doc, level, styles);
    });
    const target = frame.contentWindow;
    if (!target) throw new Error("No se pudo abrir la vista para PDF.");
    await frame.contentDocument?.fonts?.ready;
    await Promise.all([...frame.contentDocument?.images ?? []].map(async image => {
      try { await image.decode(); }
      catch { image.remove(); } // The wordmark remains available when the logo cannot load.
    }));
    target.addEventListener("afterprint", () => frame.remove(), { once: true });
    target.focus();
    target.print();
    // Some mobile browsers never dispatch afterprint.
    setTimeout(() => frame.remove(), 120000);
  } catch (error) { frame.remove(); throw error; }
}

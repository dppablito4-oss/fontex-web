import { renderToStaticMarkup } from "react-dom/server";
import type { StudioDocument } from "../../core/document-schema/document";
import type { AgentLevel } from "../../core/agent/protocol";
import { MathObjectRenderer } from "./MathObjectRenderer";
import { TeachingLevel } from "./teaching-level";

export function printableMaterial(doc: StudioDocument, level: AgentLevel) {
  return renderToStaticMarkup(<TeachingLevel.Provider value={level}><div className="st-app st-print-document"><h1>{doc.title}</h1><p>Fontex · Material de aprendizaje</p>{[...doc.objects].sort((a, b) => a.y - b.y || a.x - b.x).map(object => <section className="st-print-object" key={object.id}><h2>{object.label}</h2><MathObjectRenderer object={object} onChange={() => {}} /></section>)}</div></TeachingLevel.Provider>);
}

/** Print a separate, fully expanded document: zoom, scroll and card sizes never crop it. */
export async function exportPDF(doc: StudioDocument, level: AgentLevel) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Exportar material a PDF");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;height:800px;border:0";
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(node => node.outerHTML).join("\n");
  const content = printableMaterial(doc, level);
  document.body.append(frame);
  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error("No se pudo preparar el PDF."));
      frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8">${styles}<style>
        @page { size: A4; margin: 14mm; }
        html, body { background:white!important; color:#172033!important; margin:0; }
        .st-print-document { display:block!important; height:auto!important; min-height:0!important; background:white!important; color:#172033!important; --st-ink:#172033; --st-muted:#475569; --st-background:white; --st-soft:#eef2ff; --st-line:#cbd5e1; --st-piece-primary:#365bd6; --st-piece-secondary:#e09029; --st-piece-empty:#edf0f5; --st-piece-stroke:#344155; --st-piece-guide:#172033; font:12pt/1.5 system-ui,sans-serif; }
        .st-print-document * { overflow:visible!important; max-height:none!important; box-sizing:border-box; }
        .st-print-object { border-top:1px solid #cbd5e1; padding:12pt 0; }
        .st-print-object h2 { break-after:avoid; }
        .st-print-document :is(button,.st-step-buttons) { display:none!important; }
        .st-print-document .st-operands { flex-wrap:wrap; }
        .st-print-document svg { max-width:100%!important; min-width:0!important; max-height:220px!important; }
        .st-print-document .st-lesson li { break-inside:avoid; }
        .st-print-document .st-text-content { white-space:pre-wrap; overflow-wrap:anywhere; }
        * { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      </style></head><body>${content}</body></html>`;
    });
    const target = frame.contentWindow;
    if (!target) throw new Error("No se pudo abrir la vista para PDF.");
    await frame.contentDocument?.fonts?.ready;
    target.addEventListener("afterprint", () => frame.remove(), { once: true });
    target.focus();
    target.print();
    // Some mobile browsers never dispatch afterprint.
    setTimeout(() => frame.remove(), 120000);
  } catch (error) { frame.remove(); throw error; }
}

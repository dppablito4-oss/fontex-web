import { ChevronLeft, ChevronRight, Download, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { Button } from "../../../components/ui/button";
import { getPdfJs } from "../services/pdfService";
import type { LibraryDocument } from "../types";

export function PdfViewer({
  document,
  blob,
  onClose,
  initialPage = 1,
}: {
  document: LibraryDocument;
  blob: Blob;
  onClose: () => void;
  initialPage?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [frameWidth, setFrameWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setFrameWidth(frame.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let loadedPdf: PDFDocumentProxy | null = null;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    void (async () => {
      try {
        const pdfjs = await getPdfJs();
        const data = new Uint8Array(await blob.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data, stopAtErrors: true });
        loadedPdf = await loadingTask.promise;
        if (!active) return;
        setPdf(loadedPdf);
        const validPage = Math.min(Math.max(1, initialPage), loadedPdf.numPages);
        setPageNumber(validPage);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "No fue posible abrir el PDF.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [blob, initialPage]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || frameWidth <= 0) return;
    let active = true;
    let renderTask: RenderTask | null = null;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });

    void pdf.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, frameWidth - 32);
      const viewport = page.getViewport({ scale: availableWidth / baseViewport.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      return renderTask.promise.finally(() => page.cleanup());
    }).then(() => {
      if (active) setLoading(false);
    }).catch((renderError: unknown) => {
      if (active && !(renderError instanceof Error && renderError.name === "RenderingCancelledException")) {
        setError("No fue posible renderizar esta página.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [frameWidth, pageNumber, pdf]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function download() {
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = document.originalFilename;
    window.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--ui-overlay)] backdrop-blur-sm" role="presentation">
      <section aria-labelledby="pdf-viewer-title" aria-modal="true" className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-background shadow-2xl sm:m-4" role="dialog">
        <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Visor privado</p>
            <h2 id="pdf-viewer-title" className="truncate text-sm font-semibold sm:text-base">{document.title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button aria-label="Página anterior" disabled={!pdf || pageNumber <= 1 || loading} onClick={() => setPageNumber((page) => page - 1)} size="icon" variant="secondary"><ChevronLeft className="size-4" /></Button>
            <span className="min-w-20 text-center text-xs font-semibold">{pageNumber} / {pdf?.numPages ?? "—"}</span>
            <Button aria-label="Página siguiente" disabled={!pdf || pageNumber >= pdf.numPages || loading} onClick={() => setPageNumber((page) => page + 1)} size="icon" variant="secondary"><ChevronRight className="size-4" /></Button>
            <Button aria-label="Descargar PDF" onClick={download} size="icon" variant="secondary"><Download className="size-4" /></Button>
            <Button aria-label="Cerrar visor" onClick={onClose} size="icon" variant="ghost"><X className="size-5" /></Button>
          </div>
        </header>
        <div ref={frameRef} className="relative min-h-0 flex-1 overflow-auto bg-sidebar p-4">
          {loading && <div className="absolute inset-x-0 top-5 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs shadow"><LoaderCircle className="size-4 animate-spin" /> Preparando página…</div>}
          {error && <p className="mx-auto max-w-lg rounded-xl border border-error-border bg-error-surface p-4 text-sm text-error" role="alert">{error}</p>}
          <canvas ref={canvasRef} className="mx-auto block max-w-full bg-white shadow-xl" aria-label={`Página ${pageNumber} de ${document.title}`} />
        </div>
      </section>
    </div>
  );
}

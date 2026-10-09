import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import type { PreparedPdf } from "../types";

export const PDF_MIME_TYPE = "application/pdf";
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;

let pdfModulePromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfJs() {
  if (!pdfModulePromise) {
    pdfModulePromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfModulePromise;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function defaultTitle(filename: string) {
  return filename.replace(/[.]pdf$/i, "").trim().slice(0, 180) || "Documento PDF";
}

function readFile(file: File) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el archivo."));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("El navegador devolvió un archivo inválido."));
    };
    reader.readAsArrayBuffer(file);
  });
}

async function containsSelectableText(pdf: PDFDocumentProxy) {
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    page.cleanup();
    if (content.items.some((item) => "str" in item && item.str.trim().length > 0)) return true;
  }
  return false;
}

export async function preparePdfFile(file: File): Promise<PreparedPdf> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecciona un archivo con extensión .pdf.");
  }
  if (file.type !== PDF_MIME_TYPE) {
    throw new Error("El navegador no identificó el archivo como application/pdf.");
  }
  if (file.size < 1 || file.size > MAX_PDF_BYTES) {
    throw new Error("El PDF debe pesar como máximo 5 MiB.");
  }

  const buffer = await readFile(file);
  const signature = new TextDecoder("ascii").decode(buffer.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new Error("La firma del archivo no corresponde a un PDF.");
  }

  const pdfjs = await getPdfJs();
  let loadingTask: PDFDocumentLoadingTask | null = null;
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer.slice(0)),
      stopAtErrors: true,
    });
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`El PDF debe tener entre 1 y ${MAX_PDF_PAGES} páginas.`);
    }
    if (!(await containsSelectableText(pdf))) {
      throw new Error("No se detectó texto seleccionable. Los PDF escaneados requieren OCR y aún no son compatibles.");
    }

    return {
      file,
      title: defaultTitle(file.name),
      pageCount: pdf.numPages,
      sha256: bytesToHex(await crypto.subtle.digest("SHA-256", buffer)),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("El PDF")) throw error;
    if (error instanceof Error && error.message.startsWith("No se detectó")) throw error;
    throw new Error("PDF.js no pudo abrir el archivo. Comprueba que no esté dañado o protegido.", { cause: error });
  } finally {
    await loadingTask?.destroy();
  }
}

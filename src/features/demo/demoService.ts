import { createPageAwareChunks, type ExtractedPage } from "../../../supabase/functions/_shared/rag/chunking";
import { getPdfJs, MAX_PDF_BYTES, MAX_PDF_PAGES } from "../library/services/pdfService";
import lessons from "./lessons.json";

export type Lesson = (typeof lessons)[number];
export type Citation = { sourceId: string; title: string; page: number; excerpt: string };
export type Exchange = { question: string; citation: Citation | null };
export type DemoMaterial = {
  id: string;
  title: string;
  filename: string;
  pdf: Blob;
  pages: ExtractedPage[];
};

const stopWords = new Set(
  "a al algo alguna como con cual cuales cuando cuanto de del donde el ella en es esa ese esta este esto explica frente fue ha hay la las lo los me mi o para por que quien se segun ser si sin sobre son su sus te tu un una uno y".split(" "),
);

function terms(text: string) {
  return new Set(
    (text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .filter((word) => word.length >= 3 && !stopWords.has(word))
      .map((word) => word.length > 4 ? word.replace(/s$/, "") : word),
  );
}

export function findCitation(question: string, lesson: Lesson, material?: DemoMaterial): Citation | null {
  const query = [...terms(question)];
  if (!query.length) return null;

  const sources = [
    { id: lesson.id, title: lesson.source, pages: lesson.pages },
    ...(material ? [material] : []),
  ];
  const candidates = sources.flatMap(({ id, title, pages }) =>
    createPageAwareChunks(pages, 105, 0, "NFC").map((chunk) => {
      const words = terms(chunk.content);
      const hits = query.filter((word) => words.has(word)).length;
      return {
        hits,
        score: hits / (1 + words.size / 100),
        citation: { sourceId: id, title, page: chunk.pageStart, excerpt: chunk.content },
      };
    }),
  );
  const best = candidates
    .filter(({ hits }) => hits >= Math.ceil(query.length * 0.6))
    .sort((a, b) => b.score - a.score)[0];

  return best?.citation ?? null;
}

export async function indexMaterial(file: File): Promise<DemoMaterial> {
  if (!/\.pdf$/i.test(file.name)) throw new Error("Selecciona un archivo PDF.");
  if (!file.size || file.size > MAX_PDF_BYTES) throw new Error("El PDF debe pesar entre 1 byte y 5 MiB.");
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("El archivo no tiene una firma PDF válida.");

  const pdfjs = await getPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), stopAtErrors: true });
  try {
    const pdf = await task.promise.catch(() => {
      throw new Error("El PDF está dañado o protegido y no pudo abrirse.");
    });
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`El máximo es de ${MAX_PDF_PAGES} páginas.`);
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    if (!pages.some(({ text }) => text)) throw new Error("El PDF necesita texto seleccionable. La demo no admite escaneos.");
    return { id: crypto.randomUUID(), title: file.name.slice(0, -4) || "PDF añadido", filename: file.name, pdf: file, pages };
  } finally {
    await task.destroy();
  }
}

function openMaterials() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("fontex-demo-materials", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("materials");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No se pudo acceder al almacén de PDF.", { cause: request.error }));
    request.onblocked = () => reject(new Error("Otra pestaña está usando el almacén de PDFs."));
  });
}

export async function readMaterials() {
  const db = await openMaterials();
  try {
    const entries = await Promise.all(lessons.map(({ id }) => new Promise<[string, DemoMaterial | undefined]>((resolve, reject) => {
      const request = db.transaction("materials").objectStore("materials").get(id);
      request.onsuccess = () => resolve([id, request.result]);
      request.onerror = () => reject(new Error("No se pudo acceder al almacén de PDF.", { cause: request.error }));
    })));
    return Object.fromEntries(entries);
  } finally {
    db.close();
  }
}

export async function writeMaterial(lessonId: string, material?: DemoMaterial) {
  const db = await openMaterials();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("materials", "readwrite");
      const materials = transaction.objectStore("materials");
      if (material) materials.put(material, lessonId);
      else materials.delete(lessonId);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error("No se pudo guardar el cambio en la biblioteca.", { cause: transaction.error }));
      transaction.onerror = () => reject(new Error("No se pudo guardar el cambio en la biblioteca.", { cause: transaction.error }));
    });
  } finally {
    db.close();
  }
}

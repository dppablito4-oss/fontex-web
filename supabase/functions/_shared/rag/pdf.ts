import { type ExtractedPage, normalizeExtractedText } from "./chunking.ts";
export class ProcessingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly permanent = false,
  ) {
    super(message);
  }
}
type LoadingTask = {
  promise: Promise<
    {
      numPages: number;
      getPage(
        n: number,
      ): Promise<
        {
          getTextContent(
            options: { disableNormalization: boolean },
          ): Promise<{ items: unknown[] }>;
          cleanup(): unknown;
        }
      >;
    }
  >;
  destroy(): Promise<void>;
};
export async function extractPdfPages(
  task: LoadingTask,
  expectedPages: number,
  maximumCharacters: number,
  timeoutMs = 20000,
) {
  const deadline = Date.now() + timeoutMs;
  async function budget<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() =>
            reject(
              new ProcessingError(
                "El PDF agotó el tiempo de extracción.",
                "pdf_extraction_timeout",
                422,
                true,
              ),
            ), Math.max(0, deadline - Date.now()));
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    const pdf = await budget(task.promise);
    if (
      !Number.isInteger(pdf.numPages) || pdf.numPages < 1 ||
      pdf.numPages > 100 || pdf.numPages !== expectedPages
    ) {
      throw new ProcessingError(
        "El PDF debe tener hasta 100 páginas y coincidir con la reserva.",
        "page_count_mismatch",
        422,
        true,
      );
    }
    const pages: ExtractedPage[] = [];
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await budget(pdf.getPage(pageNumber));
      let text = "";
      try {
        const content = await budget(
          page.getTextContent({ disableNormalization: false }),
        );
        for (const item of content.items) {
          if (
            !item || typeof item !== "object" || !("str" in item) ||
            typeof item.str !== "string"
          ) continue;
          text += item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ");
          if (totalCharacters + text.length > maximumCharacters) {
            throw new ProcessingError(
              "El PDF supera el límite de texto extraíble.",
              "extracted_text_limit",
              422,
              true,
            );
          }
        }
      } finally {
        page.cleanup();
      }
      const normalized = normalizeExtractedText(text);
      totalCharacters += normalized.length;
      pages.push({ pageNumber, text: normalized });
    }
    return { pageCount: pdf.numPages, pages, totalCharacters };
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    throw new ProcessingError(
      "No fue posible extraer texto del PDF.",
      "pdf_extraction_failed",
      422,
      true,
    );
  } finally {
    await task.destroy();
  }
}

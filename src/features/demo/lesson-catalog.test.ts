// @vitest-environment node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import lessons from "../../../supabase/functions/_shared/practice/lessons.json";
import { createPayload } from "../../../supabase/functions/_shared/practice/tutor";
import { availableGrades, lessonLevel } from "./lesson-catalog";

const compact = (text: string) => text.normalize("NFKC").replace(/\s/g, "");

describe("Guías por grado", () => {
  it("ofrece una guía propia para cada edad, grado y etapa introductoria", () => {
    for (const [level, grades] of Object.entries({ inicial: [3, 4, 5], primaria: [1, 2, 3, 4, 5, 6], secundaria: [1, 2, 3, 4, 5], universidad: [1] })) {
      expect(availableGrades(level as Parameters<typeof availableGrades>[0])).toEqual(grades);
      for (const grade of grades) expect(lessons.some(lesson => lesson.level === level && lesson.grades.length === 1 && lesson.grades[0] === grade)).toBe(true);
    }
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(lessons.length);
    expect(new Set(lessons.map(lesson => lesson.pdf)).size).toBe(lessons.length);
    expect(lessonLevel("universidad-cambio")).toBe("universidad");
  });

  for (const lesson of lessons) {
    it(`${lesson.id}: coincide el PDF, las páginas citables, los ejercicios y el tutor`, async () => {
      GlobalWorkerOptions.workerSrc = pathToFileURL(resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
      const bytes = await readFile(resolve("public/demo", lesson.pdf));
      const task = getDocument({ data: new Uint8Array(bytes), stopAtErrors: true });
      try {
        const pdf = await task.promise;
        expect(pdf.numPages).toBe(lesson.pages.length);
        for (const source of lesson.pages) {
          const page = await pdf.getPage(source.pageNumber);
          const text = (await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ");
          expect(compact(text)).toContain(compact(source.text));
          for (const question of lesson.questions.filter(q => q.page === source.pageNumber)) {
            expect(compact(text)).toContain(compact(question.text));
            expect(question.correct).toBeGreaterThanOrEqual(0);
            expect(question.correct).toBeLessThan(question.options.length);
            expect(question.misconceptions).toHaveLength(question.options.length);
          }
          page.cleanup();
        }
        const payload = createPayload({ mode: "study", topic: lesson.id, question: lesson.prompt, evidence: lesson.pages[0]!.text });
        expect(payload?.input).toContain(lesson.title);
        expect(payload?.instructions).toContain(lesson.grade);
      } finally { await task.destroy(); }
    });
  }
});

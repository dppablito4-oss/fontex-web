import { BookOpen, ExternalLink } from "lucide-react";
import React, { useMemo } from "react";

import type { TutorCitation } from "../types";

function formatMathString(expr: string): string {
  return expr
    .replace(/\\cdot/g, " · ")
    .replace(/\\times/g, " × ")
    .replace(/\\pm/g, " ± ")
    .replace(/\\approx/g, " ≈ ")
    .replace(/\\le(q)?/g, " ≤ ")
    .replace(/\\ge(q)?/g, " ≥ ")
    .replace(/\\neq/g, " ≠ ")
    .replace(/\\rightarrow/g, " → ")
    .replace(/\\infty/g, " ∞ ")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\delta/g, "δ")
    .replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ")
    .replace(/\\mu/g, "μ")
    .replace(/\\pi/g, "π")
    .replace(/\\sigma/g, "σ")
    .replace(/\\omega/g, "ω")
    .replace(/\\sum/g, "∑")
    .replace(/\\int/g, "∫")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\^([0-9])/g, "ⁿ")
    .replace(/_([0-9a-zA-Z])/g, "₍$1₎");
}

function parseFormattedSpans(text: string): React.ReactNode[] {
  // Regex to detect inline math ($...$), bold (**...**), inline code (`...`), italic (*...*)
  const tokenRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("$$") && part.endsWith("$$")) {
      const math = part.slice(2, -2).trim();
      return (
        <span
          key={index}
          className="my-2 block rounded-lg border border-border bg-subtle px-3 py-2 text-center font-mono text-sm tracking-wide text-primary"
        >
          {formatMathString(math)}
        </span>
      );
    }

    if (part.startsWith("$") && part.endsWith("$")) {
      const math = part.slice(1, -1).trim();
      return (
        <span
          key={index}
          className="mx-0.5 rounded bg-subtle px-1.5 py-0.5 font-mono text-xs font-semibold text-primary"
        >
          {formatMathString(math)}
        </span>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-subtle px-1 py-0.5 font-mono text-xs text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic text-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

export function AcademicMarkdown({
  content,
  citations = [],
  onOpenCitation,
}: {
  content: string;
  citations?: TutorCitation[];
  onOpenCitation?: (citation: TutorCitation) => void;
}) {
  const blocks = useMemo(() => {
    const rawLines = content.split("\n");
    const parsedBlocks: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let blockIndex = 0;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(" ").trim();
        if (text) {
          parsedBlocks.push(
            <p key={`p-${blockIndex++}`} className="leading-relaxed text-foreground">
              {parseFormattedSpans(text)}
            </p>,
          );
        }
        currentParagraph = [];
      }
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i] ?? "";
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          parsedBlocks.push(
            <pre
              key={`code-${blockIndex++}`}
              className="my-3 overflow-x-auto rounded-xl border border-border bg-subtle p-3.5 font-mono text-xs text-foreground"
            >
              <code>{codeBlockContent.join("\n")}</code>
            </pre>,
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          flushParagraph();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        continue;
      }

      // Display math $$ ... $$
      if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
        flushParagraph();
        const math = trimmed.slice(2, -2).trim();
        parsedBlocks.push(
          <div
            key={`math-${blockIndex++}`}
            className="my-3 flex justify-center rounded-xl border border-border bg-subtle p-3 font-mono text-sm tracking-wide text-primary"
          >
            {formatMathString(math)}
          </div>,
        );
        continue;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        flushParagraph();
        parsedBlocks.push(
          <h4
            key={`h4-${blockIndex++}`}
            className="mt-4 font-display text-base font-bold text-foreground"
          >
            {parseFormattedSpans(trimmed.slice(4))}
          </h4>,
        );
        continue;
      }

      if (trimmed.startsWith("## ")) {
        flushParagraph();
        parsedBlocks.push(
          <h3
            key={`h3-${blockIndex++}`}
            className="mt-5 font-display text-lg font-bold text-foreground"
          >
            {parseFormattedSpans(trimmed.slice(3))}
          </h3>,
        );
        continue;
      }

      if (trimmed.startsWith("# ")) {
        flushParagraph();
        parsedBlocks.push(
          <h2
            key={`h2-${blockIndex++}`}
            className="mt-6 font-display text-xl font-bold text-foreground"
          >
            {parseFormattedSpans(trimmed.slice(2))}
          </h2>,
        );
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith("> ")) {
        flushParagraph();
        parsedBlocks.push(
          <blockquote
            key={`bq-${blockIndex++}`}
            className="my-2.5 border-l-4 border-primary/50 bg-subtle/50 px-3.5 py-1.5 text-sm italic text-muted-foreground"
          >
            {parseFormattedSpans(trimmed.slice(2))}
          </blockquote>,
        );
        continue;
      }

      // Lists
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        flushParagraph();
        parsedBlocks.push(
          <li key={`li-${blockIndex++}`} className="ml-5 list-disc leading-relaxed text-foreground">
            {parseFormattedSpans(trimmed.slice(2))}
          </li>,
        );
        continue;
      }

      const matchNumbered = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (matchNumbered) {
        flushParagraph();
        parsedBlocks.push(
          <li
            key={`ol-${blockIndex++}`}
            className="ml-5 list-decimal leading-relaxed text-foreground"
          >
            {parseFormattedSpans(matchNumbered[2] ?? "")}
          </li>,
        );
        continue;
      }

      currentParagraph.push(trimmed);
    }

    flushParagraph();

    return parsedBlocks;
  }, [content]);

  return (
    <div className="space-y-2.5 text-sm">
      {blocks}

      {citations.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="size-3.5 text-primary" />
            Fuentes verificadas ({citations.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {citations.map((citation, index) => {
              const pageLabel =
                citation.pageStart === citation.pageEnd
                  ? `pág. ${citation.pageStart}`
                  : `págs. ${citation.pageStart}–${citation.pageEnd}`;

              return (
                <button
                  key={`${citation.documentId}-${citation.chunkId}-${index}`}
                  type="button"
                  onClick={() => onOpenCitation?.(citation)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-surface hover:text-primary"
                  title={`Abrir ${citation.documentTitle} en ${pageLabel}`}
                >
                  <span className="font-semibold">{citation.documentTitle}</span>
                  <span className="text-muted-foreground">· {pageLabel}</span>
                  <ExternalLink className="size-3 opacity-70" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

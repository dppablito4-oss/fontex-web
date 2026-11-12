import { BookOpen, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import type { TutorCitation } from "../types";

/** Providers also use TeX delimiters, sometimes escaped twice. Leave code untouched. */
function normalizeMathDelimiters(content: string) {
  return content.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part, index) => {
    if (index % 2) return part;
    const unescapeMath = (math: string) => math.replace(/\\\\(?=[a-zA-Z])/g, "\\");
    return part
      .replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_match, math: string) => "\n\n$$\n" + unescapeMath(math).trim() + "\n$$\n\n")
      .replace(/\\{1,2}\(([^\n]*?)\\{1,2}\)/g, (_match, math: string) => "$" + unescapeMath(math).trim() + "$");
  }).join("");
}

export function AcademicMarkdown({ content, citations = [], onOpenCitation }: {
  content: string;
  citations?: TutorCitation[];
  onOpenCitation?: (citation: TutorCitation) => void;
}) {
  return <div className="academic-markdown space-y-2.5 text-sm">
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore", throwOnError: false, maxExpand: 1000 }]]}
      components={{
        p: ({ children }) => <p className="leading-relaxed text-foreground">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        a: ({ href, children }) => href
          ? <a className="text-primary underline underline-offset-2 [overflow-wrap:anywhere]" href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          : <span>{children}</span>,
        img: ({ alt }) => <span>{alt}</span>,
        h1: ({ children }) => <h2 className="mt-6 text-xl font-bold">{children}</h2>,
        h2: ({ children }) => <h3 className="mt-5 text-lg font-bold">{children}</h3>,
        h3: ({ children }) => <h4 className="mt-4 text-base font-bold">{children}</h4>,
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children, start }) => <ol className="ml-5 list-decimal space-y-1" start={start}>{children}</ol>,
        blockquote: ({ children }) => <blockquote className="my-2.5 border-l-4 border-primary/50 bg-subtle/50 px-3.5 py-1.5 italic">{children}</blockquote>,
        pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-subtle p-3.5 font-mono text-xs">{children}</pre>,
      }}
    >{normalizeMathDelimiters(content)}</ReactMarkdown>
    {citations.length > 0 && <div className="mt-4 border-t border-border pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <BookOpen className="size-3.5 text-primary" />Fuentes verificadas ({citations.length})
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{citations.map((citation, index) => {
        const pageLabel = citation.pageStart === citation.pageEnd ? "pág. " + citation.pageStart : "págs. " + citation.pageStart + "–" + citation.pageEnd;
        return <button key={citation.documentId + "-" + citation.chunkId + "-" + index} type="button"
          onClick={() => onOpenCitation?.(citation)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-surface hover:text-primary"
          title={"Abrir " + citation.documentTitle + " en " + pageLabel}>
          <span className="font-semibold">{citation.documentTitle}</span><span className="text-muted-foreground">· {pageLabel}</span><ExternalLink className="size-3 opacity-70" />
        </button>;
      })}</div>
    </div>}
  </div>;
}

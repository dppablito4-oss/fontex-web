import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourceSelectorPanel } from "./SourceSelectorPanel";
import type { LibraryDocument } from "../../library/types";

const mockDocuments: LibraryDocument[] = [
  {
    id: "doc-1",
    ownerId: "user-1",
    classroomId: "class-1",
    title: "Física I - Cinemática",
    originalFilename: "fisica1.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024 * 100,
    pageCount: 25,
    storagePath: "123/456.pdf",
    status: "ready",
    failureCode: null,
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-09T00:00:00Z",
    shares: [{ id: "s-1", documentId: "doc-1", scopeType: "classroom", classroomId: "class-1", groupId: null, grantedBy: "user-1" }],
    processing: {
      id: "p-1",
      status: "ready",
      phase: "complete",
      chunkCount: 12,
      embeddedChunkCount: 12,
      embeddingTokens: 3000,
      failureCount: 0,
      failureCode: null,
      failureDetail: null,
      updatedAt: "2026-10-09T00:00:00Z",
    },
  },
  {
    id: "doc-2",
    ownerId: "user-1",
    classroomId: "class-1",
    title: "Apuntes Privados",
    originalFilename: "privado.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024 * 50,
    pageCount: 5,
    storagePath: "123/789.pdf",
    status: "pending",
    failureCode: null,
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-09T00:00:00Z",
    shares: [],
    processing: {
      id: "p-2",
      status: "processing",
      phase: "embedding",
      chunkCount: 4,
      embeddedChunkCount: 2,
      embeddingTokens: 500,
      failureCount: 0,
      failureCode: null,
      failureDetail: null,
      updatedAt: "2026-10-09T00:00:00Z",
    },
  },
];

describe("SourceSelectorPanel", () => {
  it("muestra la lista de documentos y sus estados de indexación", () => {
    render(
      <SourceSelectorPanel
        documents={mockDocuments}
        selectedIds={[]}
        onSelectIds={vi.fn()}
        onOpenCitation={vi.fn()}
      />,
    );

    expect(screen.getByText("Fuentes Académicas")).toBeInTheDocument();
    expect(screen.getByText("Física I - Cinemática")).toBeInTheDocument();
    expect(screen.getByText(/Indexado \(12\)/)).toBeInTheDocument();
    expect(screen.getByText("Apuntes Privados")).toBeInTheDocument();
    expect(screen.getByText("Indexando…")).toBeInTheDocument();
  });

  it("permite seleccionar y deseleccionar documentos", () => {
    const onSelect = vi.fn();
    render(
      <SourceSelectorPanel
        documents={mockDocuments}
        selectedIds={["doc-1"]}
        onSelectIds={onSelect}
        onOpenCitation={vi.fn()}
      />,
    );

    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();

    // Toggle off doc-1
    fireEvent.click(screen.getByText("Física I - Cinemática"));
    expect(onSelect).toHaveBeenCalledWith([]);

    // Select all indexed
    fireEvent.click(screen.getByRole("button", { name: /Seleccionar indexados/i }));
    expect(onSelect).toHaveBeenCalledWith(["doc-1"]);
  });

  it("filtra por alcance aula o privados", () => {
    render(
      <SourceSelectorPanel
        documents={mockDocuments}
        selectedIds={[]}
        onSelectIds={vi.fn()}
        onOpenCitation={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Aula$/i }));
    expect(screen.getByText("Física I - Cinemática")).toBeInTheDocument();
    expect(screen.queryByText("Apuntes Privados")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Privados$/i }));
    expect(screen.queryByText("Física I - Cinemática")).not.toBeInTheDocument();
    expect(screen.getByText("Apuntes Privados")).toBeInTheDocument();
  });
});

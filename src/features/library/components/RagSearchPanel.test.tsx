import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchDocumentChunks } from "../services/documentService";
import { RagSearchPanel } from "./RagSearchPanel";

vi.mock("../services/documentService", () => ({
  searchDocumentChunks: vi.fn(),
}));

const searchMock = vi.mocked(searchDocumentChunks);

describe("RAG diagnostic search panel", () => {
  beforeEach(() => searchMock.mockReset());

  it("shows authorized page-aware results without presenting them as tutor context", async () => {
    searchMock.mockResolvedValue([{
      chunkId: 41,
      documentId: "document-1",
      documentTitle: "Biología celular",
      pageStart: 7,
      pageEnd: 7,
      content: "El ATP participa en la transferencia de energía.",
      semanticSimilarity: 0.91,
      lexicalRank: 0.4,
      combinedScore: 0.016,
    }]);
    render(<RagSearchPanel />);

    expect(screen.getByText("No conectado al tutor")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Consulta para recuperar fragmentos" }), {
      target: { value: "ATP y energía" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }));

    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("ATP y energía", "all"));
    expect(await screen.findByText("Biología celular")).toBeInTheDocument();
    expect(screen.getByText("p. 7")).toBeInTheDocument();
    expect(screen.getByText(/transferencia de energía/)).toBeInTheDocument();
  });
});

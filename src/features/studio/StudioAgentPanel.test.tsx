import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDocument } from "../../core/object-registry/registry";
import { StudioAgentPanel } from "./StudioAgentPanel";

it("prepara una propuesta local y requiere aplicar la vista previa", () => {
  const doc = createDocument();
  const apply = vi.fn(() => true);
  render(<StudioAgentPanel document={doc} selectedId={null} onApply={apply} />);
  fireEvent.click(screen.getByText("Fontex Agent"));
  fireEvent.click(screen.getByRole("button", { name: "Preparar ejemplo" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar acciones" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Aplicar acciones" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ documentId: doc.id }), doc);
});

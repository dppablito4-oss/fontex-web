import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoPage } from "./DemoPage";
import { findCitation } from "./demoService";
import lessons from "./lessons.json";

vi.mock("./demoService", { spy: true });

beforeEach(async () => {
  const service = await import("./demoService");
  vi.mocked(service.readMaterials).mockResolvedValue({});
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

describe("Aula de práctica", () => {
  it("recupera la página real de cada guía y se abstiene fuera del tema", () => {
    const physicsCitation = findCitation(lessons[0]!.prompt, lessons[0]!);
    expect(physicsCitation).toMatchObject({ page: 2, sourceId: "fisica" });
    expect(physicsCitation?.excerpt).toContain("m/s²");
    expect(findCitation(lessons[1]!.prompt, lessons[1]!)).toMatchObject({ page: 1, sourceId: "matematica" });
    expect(findCitation("¿Quién ganó el mundial de fútbol?", lessons[0]!)).toBeNull();
  });

  it("corrige un ejercicio y conserva el resultado después de volver a entrar", async () => {
    const firstVisit = render(<DemoPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Mi aula de práctica" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Empezar práctica" }));

    const exercise = screen.getByRole("group", { name: /un ciclista/i });
    fireEvent.click(within(exercise).getByRole("radio", { name: "En 14 m" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Comprobar" })[0]!);
    expect(screen.getByText("Correcto.")).toBeVisible();
    firstVisit.unmount();

    render(<DemoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver mi práctica" }));
    expect(screen.getByText("1 de 3 resueltos")).toBeVisible();
    expect(screen.getByText("Correcto.")).toBeVisible();
  });

  it("conserva el historial del tutor con su página y la abstención al recargar", async () => {
    const firstVisit = render(<DemoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Tutor", exact: true }));
    const suggested = screen.getByRole("button", { name: lessons[0]!.prompt });
    await waitFor(() => expect(suggested).toBeEnabled());
    fireEvent.click(suggested);
    fireEvent.click(screen.getByRole("button", { name: /fuera del tema/i }));
    firstVisit.unmount();

    render(<DemoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Tutor", exact: true }));
    expect(screen.getByRole("button", { name: /guía de movimiento rectilíneo · p. 2/i })).toBeVisible();
    expect(screen.getByText(/no encontré un fragmento/i)).toBeVisible();
  });
});

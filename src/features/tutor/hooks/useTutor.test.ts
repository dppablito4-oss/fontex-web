import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversation, deleteConversation, invokeTutorChat, listConversations, listMessages, updateConversation } from "../services/tutorService";
import type { TutorConversation, TutorMessageRecord } from "../types";
import { useTutor } from "./useTutor";

vi.mock("../services/tutorService");
vi.mock("../../library/services/documentService", () => ({ downloadDocument: vi.fn() }));
const conversation = (id: string, classroomId = "class-a"): TutorConversation => ({ id, classroomId, userId: "user",
  title: id, mode: "strict", guided: false, selectedDocumentIds: [], createdAt: "2026-11-11", updatedAt: "2026-11-11" });
const message = (id: string): TutorMessageRecord => ({ id, conversationId: id, role: "assistant", content: `Mensaje ${id}`, createdAt: "2026-11-11" });
const response = (id: string) => ({ text: "Respuesta tardía", model: "test", mode: "strict" as const,
  guided: false, conversationId: id, messageId: "late", citations: [] });

beforeEach(() => {
  vi.mocked(listConversations).mockImplementation((classroomId) => Promise.resolve(classroomId === "class-a"
    ? [conversation("a"), conversation("b")] : [conversation("c", classroomId)]));
  vi.mocked(listMessages).mockImplementation((id) => Promise.resolve([message(id)]));
  vi.mocked(updateConversation).mockResolvedValue();
  vi.mocked(deleteConversation).mockResolvedValue();
  vi.mocked(createConversation).mockResolvedValue(conversation("new"));
});

describe("Respuestas del tutor por conversación y aula", () => {
  it("conserva el historial al seleccionar la conversación que ya está activa", async () => {
    const { result } = renderHook(() => useTutor({ classroomId: "class-a" }));
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("Mensaje a"));
    act(() => result.current.selectConversation("a"));
    expect(result.current.messages.map((item) => item.content)).toEqual(["Mensaje a"]);
  });
  it.each(["a", "created-by-server"])("ignora una respuesta de %s al seleccionar otra conversación", async (returnedId) => {
    let resolve!: (value: Awaited<ReturnType<typeof invokeTutorChat>>) => void;
    vi.mocked(invokeTutorChat).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useTutor({ classroomId: "class-a" }));
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("Mensaje a"));
    let pending!: Promise<void>;
    act(() => { pending = result.current.sendMessage("Pregunta A"); });
    act(() => result.current.selectConversation("b"));
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("Mensaje b"));
    await act(async () => { resolve(response(returnedId)); await pending; });
    expect(result.current.activeConversationId).toBe("b");
    expect(result.current.messages.map((item) => item.content)).toEqual(["Mensaje b"]);
    expect(vi.mocked(invokeTutorChat).mock.calls.at(-1)?.[0].signal?.aborted).toBe(true);
  });
  it("ignora la respuesta del aula anterior después de cambiar de aula", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof invokeTutorChat>>) => void;
    vi.mocked(invokeTutorChat).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ classroomId }) => useTutor({ classroomId }), { initialProps: { classroomId: "class-a" } });
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("Mensaje a"));
    let pending!: Promise<void>;
    act(() => { pending = result.current.sendMessage("Pregunta A"); });
    rerender({ classroomId: "class-b" });
    await waitFor(() => expect(result.current.messages[0]?.content).toBe("Mensaje c"));
    await act(async () => { resolve(response("a")); await pending; });
    expect(result.current.activeConversationId).toBe("c");
    expect(result.current.messages.map((item) => item.content)).toEqual(["Mensaje c"]);
    expect(result.current.sending).toBe(false);
  });
});

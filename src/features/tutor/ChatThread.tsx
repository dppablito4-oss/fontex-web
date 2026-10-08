import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { ArrowDown, ArrowUp, Bot, UserRound } from "lucide-react";

function ChatMessage() {
  return (
    <MessagePrimitive.Root className="aui-message">
      <MessagePrimitive.If user>
        <div className="aui-message-row aui-message-user">
          <div className="aui-bubble aui-user-bubble">
            <MessagePrimitive.Parts />
          </div>
          <span className="aui-avatar bg-ink text-paper"><UserRound className="size-4" /></span>
        </div>
      </MessagePrimitive.If>
      <MessagePrimitive.If assistant>
        <div className="aui-message-row">
          <span className="aui-avatar bg-[#dce9e1] text-forest"><Bot className="size-4" /></span>
          <div>
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Fontex</span>
            <div className="aui-bubble aui-assistant-bubble">
              <MessagePrimitive.Parts />
            </div>
          </div>
        </div>
      </MessagePrimitive.If>
    </MessagePrimitive.Root>
  );
}

export function ChatThread() {
  return (
    <ThreadPrimitive.Root className="aui-root">
      <ThreadPrimitive.Viewport className="aui-viewport">
        <ThreadPrimitive.Messages components={{ Message: ChatMessage }} />
        <ThreadPrimitive.ViewportFooter className="aui-footer">
          <ThreadPrimitive.ScrollToBottom className="aui-scroll" aria-label="Ir al mensaje más reciente">
            <ArrowDown className="size-4" />
          </ThreadPrimitive.ScrollToBottom>
          <ComposerPrimitive.Root className="aui-composer">
            <ComposerPrimitive.Input
              className="aui-input"
              placeholder="Pregunta sobre las fuentes seleccionadas…"
              aria-label="Mensaje para el tutor"
            />
            <ComposerPrimitive.Send className="aui-send" aria-label="Enviar mensaje">
              <ArrowUp className="size-4" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          <p className="mt-2 text-center text-[10px] leading-4 text-muted">
            Prototipo local. Verifica siempre la evidencia citada.
          </p>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

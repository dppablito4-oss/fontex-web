/** Route a direct editing request without spending a second model call. */
export type ConversationTurn = { role: "user" | "assistant"; content: string };
export function agentTask(question: string): "chat" | "build" {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/^[¿¡]+/, "");
  // Questions about capabilities, quoted examples and negated instructions are conversation.
  if (/\b(?:si digo|si escribo|se puede crear|es posible crear)\b/.test(text) || /^(?:no\b|(?:como|por que|que|cual|cuando|explica|explicame|dime|cuentame)\b)/.test(text)) return "chat";
  if (/^(?:(?:me )?(?:puedes|podrias) )?(?:explica(?:r|me|rme)?|dime|cuentame|ayudame a entender)\b/.test(text) || /\bquiero (?:saber|entender)\b/.test(text)) return "chat";
  if (/^(?:(?:me )?(?:puedes|podrias)\s+)?(?:grafica(?:r|me)?|traza(?:r|me)?)\b/.test(text)) return "build";
  const command = text.replace(/\b(?:sin|no)\s+(?:crear|crees|modificar|modifiques|cambiar|cambies|eliminar|borrar)\b/g, "");
  return /\b(?:crea(?:r|me|lo|los)?|genera(?:r|me|lo|los)?|anade|agrega(?:r|me)?|dibuja(?:r|me)?|construye|modifica(?:r)?|cambia(?:r)?|actualiza|elimina(?:r)?|borra(?:r)?|quita|reorganiza|simplifica|adapta|hacer|haz(?:lo|los)?|aplica(?:lo)?|pon(?:lo)?|prepara(?:r|me)?)\b/.test(command) ? "build" : "chat";
}
export const chatOutputSchema = {
  type: "object", additionalProperties: false, required: ["message", "actions"],
  properties: { message: { type: "string" }, actions: { type: "array", maxItems: 0, items: { type: "string" } } },
};

import type { ConversationTurn } from "../../core/agent/conversation";
import { parseScene, type Scene } from "../../core/scene/document";
import type { StudioDocument } from "../../core/document-schema/document";
export function migrateMaterial(document: StudioDocument, conversation: ConversationTurn[] = []): Scene {
  return parseScene({ version: 1, id: `import-${document.id}`, updatedAt: document.updatedAt, title: document.title, conversation, expressions: [], elements: document.objects.map((object,index)=>({id:`e-${index}`,kind:"legacy",object})) });
}

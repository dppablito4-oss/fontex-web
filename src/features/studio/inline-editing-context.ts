import { createContext } from "react";
import type { MathObject } from "../../core/document-schema/document";
export type InlineEditing = { object: MathObject; onChange: (object: MathObject) => void; onBegin?: () => void; onEnd?: () => void; onCancel?: () => void };
export const InlineEditingContext = createContext<InlineEditing | null>(null);

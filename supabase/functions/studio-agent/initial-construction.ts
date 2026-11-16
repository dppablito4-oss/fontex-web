import { z } from "zod";
import {
  type PrimitiveReply,
  primitiveSchema,
  replySchema,
  variableSchema,
} from "../../../src/core/primitives/schema.ts";

// An empty canvas needs objects, not only instructions to set variables.
// Separate lists make that requirement enforceable in Structured Outputs.
export const initialConstructionSchema = z.object({
  message: z.string().min(1).max(4000),
  variables: z.array(variableSchema).max(24),
  primitives: z.array(primitiveSchema).min(1).max(40),
}).strict();
export function constructionReply(
  value: unknown,
  initial: boolean,
): PrimitiveReply {
  if (
    initial && value && typeof value === "object" &&
    ("primitives" in value || "variables" in value)
  ) {
    const construction = initialConstructionSchema.parse(value);
    return replySchema.parse({
      message: construction.message,
      actions: [
        ...construction.variables.map((variable) => ({
          kind: "upsert_variable",
          variable,
        })),
        ...construction.primitives.map((primitive) => ({
          kind: "add_primitive",
          primitive,
        })),
      ],
    });
  }
  // Existing callers and stored receipts retain the canonical patch format.
  return replySchema.parse(value);
}

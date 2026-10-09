import { describe, expect, it } from "vitest";

import type { LibraryDocument } from "./types";
import { getDocumentScope } from "./types";

const baseDocument: LibraryDocument = {
  id: "document-id",
  ownerId: "owner-id",
  classroomId: "classroom-id",
  title: "Documento",
  originalFilename: "documento.pdf",
  mimeType: "application/pdf",
  sizeBytes: 100,
  pageCount: 1,
  storagePath: "document/object.pdf",
  status: "ready",
  failureCode: null,
  createdAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
  shares: [],
};

describe("document scope", () => {
  it("keeps documents private without explicit shares", () => {
    expect(getDocumentScope(baseDocument)).toBe("private");
  });

  it("identifies group access", () => {
    expect(getDocumentScope({
      ...baseDocument,
      shares: [{
        id: "share-id",
        documentId: baseDocument.id,
        scopeType: "group",
        classroomId: null,
        groupId: "group-id",
        grantedBy: baseDocument.ownerId,
      }],
    })).toBe("group");
  });

  it("gives classroom access visual precedence when both shares exist", () => {
    expect(getDocumentScope({
      ...baseDocument,
      shares: [
        {
          id: "group-share",
          documentId: baseDocument.id,
          scopeType: "group",
          classroomId: null,
          groupId: "group-id",
          grantedBy: baseDocument.ownerId,
        },
        {
          id: "classroom-share",
          documentId: baseDocument.id,
          scopeType: "classroom",
          classroomId: baseDocument.classroomId,
          groupId: null,
          grantedBy: baseDocument.ownerId,
        },
      ],
    })).toBe("classroom");
  });
});

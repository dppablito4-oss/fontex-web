import { describe, expect, it } from "vitest";
import {
  createDocument,
  createObject,
} from "../../core/object-registry/registry";
import {
  lastMaterial,
  listMaterials,
  loadMaterial,
  removeMaterial,
  saveMaterial,
} from "./document-store";

describe("Guardado local por propietario", () => {
  it("recupera todas las propiedades y conserva materiales distintos", () => {
    const fractions = createDocument();
    const note = createObject("text");
    if (note.type === "text") note.data.content = "Explicación editada";
    note.x = 300;
    note.y = 680;
    fractions.objects.push(note);
    saveMaterial(localStorage, "guest", fractions);
    const sequences = createDocument("sequences");
    saveMaterial(localStorage, "guest", sequences);
    expect(lastMaterial(localStorage, "guest")).toEqual(sequences);
    expect(loadMaterial(localStorage, "guest", fractions.id)).toEqual(
      fractions,
    );
    expect(listMaterials(localStorage, "guest")).toHaveLength(2);
  });
  it("separa cuentas e invitados incluso en el mismo navegador", () => {
    const document = createDocument();
    saveMaterial(localStorage, "ana", document);
    expect(lastMaterial(localStorage, "guest")).toBeNull();
    expect(lastMaterial(localStorage, "luis")).toBeNull();
    expect(() => loadMaterial(localStorage, "luis", document.id)).toThrow();
    expect(listMaterials(localStorage, "luis")).toEqual([]);
    removeMaterial(localStorage, "luis", document.id);
    expect(loadMaterial(localStorage, "ana", document.id)).toEqual(document);
  });
  it("rechaza datos corruptos y no informa éxito si no hay almacenamiento", () => {
    localStorage.setItem("fontex-studio-v1:guest:index", "{");
    expect(() => listMaterials(localStorage, "guest")).toThrow();
    expect(() =>
      saveMaterial(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error("QuotaExceeded");
          },
          removeItem: () => undefined,
        },
        "guest",
        createDocument(),
      ),
    ).toThrow();
  });
});

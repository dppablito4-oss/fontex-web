import { describe, expect, it, vi } from "vitest";
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
  it("permite recuperar un material legado válido y eliminar otro dañado sin perderlo", () => {
    const valid = createDocument();
    const broken = createDocument("sequences");
    const prefix = "fontex-studio-v1:guest:";
    localStorage.setItem(`${prefix}index`, JSON.stringify([valid, broken]));
    localStorage.setItem(`${prefix}document:${valid.id}`, JSON.stringify(valid));
    localStorage.setItem(`${prefix}document:${broken.id}`, "{");
    localStorage.setItem(`${prefix}active`, valid.id);
    expect(lastMaterial(localStorage, "guest")).toEqual(valid);
    expect(listMaterials(localStorage, "guest")).toHaveLength(2);
    expect(() => saveMaterial(localStorage, "guest", valid)).toThrow();
    expect(localStorage.getItem(`${prefix}document:${broken.id}`)).toBe("{");
    removeMaterial(localStorage, "guest", broken.id);
    expect(lastMaterial(localStorage, "guest")).toEqual(valid);
    expect(listMaterials(localStorage, "guest")).toHaveLength(1);
  });
  it("migra materiales v1 completos sin perder sus datos ni otras cuentas", () => {
    const first = createDocument();
    const second = createDocument("sequences");
    const prefix = "fontex-studio-v1:ana:";
    localStorage.setItem(`${prefix}index`, JSON.stringify([first, second]));
    localStorage.setItem(`${prefix}document:${first.id}`, JSON.stringify(first));
    localStorage.setItem(`${prefix}document:${second.id}`, JSON.stringify(second));
    localStorage.setItem(`${prefix}active`, second.id);
    localStorage.setItem("fontex-studio-v1:luis:index", "[]");
    expect(lastMaterial(localStorage, "ana")).toEqual(second);
    saveMaterial(localStorage, "ana", first);
    expect(loadMaterial(localStorage, "ana", second.id)).toEqual(second);
    expect(lastMaterial(localStorage, "ana")).toEqual(first);
    expect(localStorage.getItem(`${prefix}index`)).toBeNull();
    expect(localStorage.getItem("fontex-studio-v1:luis:index")).toBe("[]");
  });
  it("un fallo de escritura conserva documento, índice y activo anteriores juntos", () => {
    const first = createDocument();
    saveMaterial(localStorage, "guest", first);
    const before = localStorage.getItem("fontex-studio-v2:guest");
    const storage = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: () => { throw new Error("QuotaExceeded"); },
      removeItem: (key: string) => localStorage.removeItem(key),
    };
    expect(() => saveMaterial(storage, "guest", createDocument())).toThrow();
    expect(() => removeMaterial(storage, "guest", first.id)).toThrow();
    expect(localStorage.getItem("fontex-studio-v2:guest")).toBe(before);
    expect(lastMaterial(localStorage, "guest")).toEqual(first);
    expect(listMaterials(localStorage, "guest")).toHaveLength(1);
  });
  it("conserva v1 si falla su migración y usa v2 aunque falle limpiar el legado", () => {
    const document = createDocument();
    const prefix = "fontex-studio-v1:guest:";
    localStorage.setItem(`${prefix}index`, JSON.stringify([document]));
    localStorage.setItem(`${prefix}document:${document.id}`, JSON.stringify(document));
    localStorage.setItem(`${prefix}active`, document.id);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("QuotaExceeded"); });
    expect(() => saveMaterial(localStorage, "guest", document)).toThrow();
    write.mockRestore();
    expect(lastMaterial(localStorage, "guest")).toEqual(document);
    const cleanup = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Blocked"); });
    saveMaterial(localStorage, "guest", { ...document, title: "Actualizado" });
    cleanup.mockRestore();
    expect(lastMaterial(localStorage, "guest")?.title).toBe("Actualizado");
  });
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

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Copy,
  Download,
  Expand,
  FolderOpen,
  Layers3,
  Minus,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  BOARD,
  MAX_OBJECTS,
  fitObject,
  parseDocument,
  uid,
  type MathObject,
  type ObjectType,
} from "../../core/document-schema/document";
import {
  createDocument,
  createObject,
  objectRegistry,
} from "../../core/object-registry/registry";
import { useAuth } from "../auth/AuthProvider";
import { CanvasViewport } from "./CanvasViewport";
import { PropertiesInspector } from "./PropertiesInspector";
import { useStudioDocument } from "./useStudioDocument";
import "./studio.css";

export function StudioShell() {
  const { user, status } = useAuth();
  if (status === "loading")
    return (
      <main className="st-loading" role="status">
        Preparando tu espacio…
      </main>
    );
  return <StudioEditor key={user?.id ?? "guest"} owner={user?.id ?? "guest"} />;
}

function StudioEditor({ owner }: { owner: string }) {
  const { user, signOut, error: accountError } = useAuth();
  const store = useStudioDocument(owner);
  const doc = store.document;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() =>
    window.innerWidth < 760 ? 0.5 : 0.65,
  );
  const [presenting, setPresenting] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const work = useRef<HTMLElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const importBusy = useRef(false);
  const selected = doc.objects.find((object) => object.id === selectedId);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setPresenting(false);
    }
    function fullscreen() {
      if (!document.fullscreenElement) setPresenting(false);
    }
    window.addEventListener("keydown", escape);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("keydown", escape);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);
  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (materialsOpen && !modal.open) modal.showModal();
    else if (!materialsOpen && modal.open) modal.close();
  }, [materialsOpen]);

  function changeObject(object: MathObject) {
    store.update((current) => ({
      ...current,
      objects: current.objects.map((item) =>
        item.id === object.id ? object : item,
      ),
    }));
  }
  function add(type: ObjectType) {
    if (doc.objects.length >= MAX_OBJECTS) {
      setNotice(`Este material admite hasta ${MAX_OBJECTS} objetos.`);
      return;
    }
    const object = createObject(type, doc.objects.length);
    const bottom = Math.max(
      0,
      ...doc.objects.map((item) => item.y + item.height),
    );
    const next = fitObject({
      ...object,
      x: 60 + (doc.objects.length % 3) * 60,
      y: bottom + 30,
    });
    store.update((current) => ({
      ...current,
      objects: [...current.objects, next],
    }));
    setSelectedId(next.id);
    setNotice("");
  }
  function remove(id: string) {
    store.update((current) => ({
      ...current,
      objects: current.objects.filter((object) => object.id !== id),
    }));
    setSelectedId(null);
  }
  function duplicate() {
    if (!selected || doc.objects.length >= MAX_OBJECTS) return;
    const next = fitObject({
      ...selected,
      id: uid(),
      label: `${selected.label.slice(0, 110)} (copia)`,
      x: selected.x + 30,
      y: selected.y + 30,
      data: { ...selected.data },
    } as MathObject);
    store.update((current) => ({
      ...current,
      objects: [...current.objects, next],
    }));
    setSelectedId(next.id);
  }
  function newMaterial(template: "blank" | "fractions" | "sequences") {
    if (store.replace(createDocument(template))) {
      setSelectedId(null);
      setMaterialsOpen(false);
      setNotice("");
    }
  }
  function exportDocument() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "material-fontex"}.fontex.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Copia JSON exportada. Puedes importarla en otra computadora.");
  }
  async function importDocument(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget,
      selectedFile = input.files?.[0];
    if (!selectedFile || importBusy.current) return;
    importBusy.current = true;
    try {
      if (selectedFile.size > 1024 * 1024)
        throw new Error("El archivo debe pesar menos de 1 MB.");
      const parsed = parseDocument(
        JSON.parse(await selectedFile.text()) as unknown,
      );
      if (
        store.replace({
          ...parsed,
          id: uid(),
          updatedAt: new Date().toISOString(),
        })
      ) {
        setSelectedId(null);
        setNotice("Material importado como una nueva copia.");
      }
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "No se pudo importar el archivo.",
      );
    } finally {
      input.value = "";
      importBusy.current = false;
    }
  }
  function fit() {
    const width = work.current?.clientWidth ?? 1000;
    const height = (work.current?.clientHeight ?? 700) - 55;
    setZoom(
      Math.max(
        0.2,
        Math.min(1, (width - 48) / BOARD.width, (height - 40) / BOARD.height),
      ),
    );
  }
  async function present() {
    setSelectedId(null);
    setPresenting(true);
    try {
      await root.current?.requestFullscreen?.();
    } catch {
      /* The distraction-free view also works without the fullscreen API. */
    }
    setZoom(
      Math.max(
        0.2,
        Math.min(
          1,
          (window.innerWidth - 48) / BOARD.width,
          (window.innerHeight - 110) / BOARD.height,
        ),
      ),
    );
  }
  async function leavePresentation() {
    setPresenting(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* Keep the visible exit available. */
      }
    }
    setZoom(window.innerWidth < 760 ? 0.5 : 0.65);
  }
  async function leaveAccount() {
    if (!store.persist()) return;
    try {
      await signOut();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "No fue posible cerrar sesión.",
      );
    }
  }
  return (
    <div ref={root} className={`st-app ${presenting ? "st-presenting" : ""}`}>
      <header className="st-header">
        <a href="#/" className="st-brand">
          <span>
            <Layers3 size={24} />
          </span>
          fontex <small>STUDIO</small>
        </a>
        <div className="st-document-heading">
          <input
            key={`${doc.id}:${doc.title}`}
            aria-label="Título del material"
            defaultValue={doc.title}
            maxLength={160}
            onBlur={(event) => {
              const title = event.currentTarget.value.trim();
              if (title && title !== doc.title)
                store.update((current) => ({ ...current, title }));
              else event.currentTarget.value = doc.title;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <span>
            {store.saved
              ? "Guardado en este navegador"
              : "Guarda o exporta tu material"}
          </span>
        </div>
        <div className="st-header-actions">
          <button
            className="st-icon-button"
            aria-label="Deshacer"
            title="Deshacer"
            onClick={store.undo}
            disabled={!store.canUndo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="st-icon-button"
            aria-label="Rehacer"
            title="Rehacer"
            onClick={store.redo}
            disabled={!store.canRedo}
          >
            <Redo2 size={18} />
          </button>
          <button onClick={() => store.persist()}>
            <Save size={17} />
            <span>Guardar</span>
          </button>
          <button className="st-primary" onClick={() => void present()}>
            <Expand size={17} />
            <span>Presentar</span>
          </button>
        </div>
      </header>
      {(store.error || accountError || notice) && !presenting && (
        <div
          className={`st-banner ${store.error || accountError ? "st-error" : ""}`}
          role={store.error || accountError ? "alert" : "status"}
        >
          {store.error || accountError || notice}
          <button
            aria-label="Cerrar aviso"
            onClick={() => setNotice("")}
            disabled={!!(store.error || accountError)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="st-layout">
        <aside className="st-palette" aria-label="Herramientas del editor">
          <div className="st-palette-intro">
            <span className="st-eyebrow">MATEMÁTICA, A LA VISTA</span>
            <h1>
              Una idea.
              <br />
              Muchas formas.
            </h1>
            <p>Construye materiales para explicar y explorar en clase.</p>
          </div>
          <div className="st-section-label">AÑADIR AL LIENZO</div>
          <div className="st-add-buttons">
            {(Object.keys(objectRegistry) as ObjectType[]).map((type) => (
              <button
                key={type}
                aria-label={`Añadir ${objectRegistry[type].name.toLocaleLowerCase("es")}`}
                disabled={doc.objects.length >= MAX_OBJECTS}
                onClick={() => add(type)}
              >
                <span
                  aria-hidden="true"
                  className={`st-type-icon st-type-${type}`}
                >
                  {
                    { fraction: "⅔", operation: "±", text: "T", sequence: "⋯" }[
                      type
                    ]
                  }
                </span>
                <span>{objectRegistry[type].name}</span>
                <Plus size={14} />
              </button>
            ))}
          </div>
          <div className="st-palette-divider" />
          <div className="st-section-label">TUS MATERIALES</div>
          <div className="st-file-buttons">
            <button onClick={() => setMaterialsOpen(true)}>
              <FolderOpen size={17} /> Abrir / crear material
            </button>
            <button onClick={exportDocument}>
              <Download size={17} /> Exportar JSON
            </button>
            <button onClick={() => file.current?.click()}>
              <Upload size={17} /> Importar JSON
            </button>
            <a href="#/fracciones">Abrir laboratorio de fracciones ↗</a>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Importar material JSON"
            onChange={(event) => void importDocument(event)}
          />
          <div className="st-local-note">
            <strong>Tu material, a mano.</strong>
            <p>
              El guardado es local a este navegador y esta cuenta. Exporta una
              copia para llevarlo a otra computadora.
            </p>
            {user ? (
              <button onClick={() => void leaveAccount()}>Cerrar sesión</button>
            ) : (
              <a
                href="#/ingresar"
                onClick={(event) => {
                  if (!store.persist()) event.preventDefault();
                }}
              >
                Iniciar sesión
              </a>
            )}
          </div>
        </aside>
        <main
          ref={work}
          className="st-workspace"
          aria-label="Editor del material"
        >
          <div className="st-workspace-heading">
            <span>
              <i /> Lienzo matemático{" "}
              <small>{doc.objects.length} objetos</small>
            </span>
            <span>Mueve desde el encabezado · Flechas para ajustar</span>
          </div>
          <CanvasViewport
            objects={doc.objects}
            selectedId={selectedId}
            zoom={zoom}
            presenting={presenting}
            onSelect={setSelectedId}
            onChange={changeObject}
            onDelete={remove}
          />
          <div className="st-canvas-footer">
            <span>{presenting ? doc.title : "Explora. Conecta. Explica."}</span>
            <div className="st-zoom">
              <button
                aria-label="Alejar"
                disabled={zoom <= 0.2}
                onClick={() => setZoom((value) => Math.max(0.2, value - 0.1))}
              >
                <Minus size={16} />
              </button>
              <output aria-label="Nivel de zoom">
                {Math.round(zoom * 100)}%
              </output>
              <button
                aria-label="Acercar"
                disabled={zoom >= 1.5}
                onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
              >
                <Plus size={16} />
              </button>
              <button aria-label="Ajustar lienzo" onClick={fit}>
                <Expand size={16} />
              </button>
            </div>
          </div>
        </main>
        <aside className="st-inspector" aria-label="Propiedades del objeto">
          <div className="st-inspector-heading">
            <h2>
              {selected ? objectRegistry[selected.type].name : "Propiedades"}
            </h2>
            {selected && (
              <button
                aria-label="Cerrar propiedades"
                onClick={() => setSelectedId(null)}
              >
                <X size={17} />
              </button>
            )}
          </div>
          {selected ? (
            <>
              <div className="st-object-actions">
                <button
                  onClick={duplicate}
                  disabled={doc.objects.length >= MAX_OBJECTS}
                >
                  <Copy size={16} /> Duplicar
                </button>
                <button onClick={() => remove(selected.id)}>
                  <Trash2 size={16} /> Eliminar
                </button>
              </div>
              <PropertiesInspector
                key={JSON.stringify(selected)}
                object={selected}
                onApply={changeObject}
              />
            </>
          ) : (
            <div className="st-inspector-empty">
              <span>↖</span>
              <h3>Todo empieza con un objeto.</h3>
              <p>
                Selecciona uno en el lienzo para cambiar sus valores, su texto o
                su tamaño.
              </p>
              <p>
                Las operaciones guiadas se pueden recorrer directamente sobre el
                material.
              </p>
            </div>
          )}
        </aside>
      </div>
      {presenting && (
        <button
          className="st-exit-presentation"
          onClick={() => void leavePresentation()}
        >
          <X size={17} /> Salir de presentación <small>Esc</small>
        </button>
      )}
      <dialog
        ref={dialog}
        className="st-materials-dialog"
        aria-labelledby="st-materials-title"
        onClose={() => setMaterialsOpen(false)}
      >
        <div className="st-dialog-heading">
          <h2 id="st-materials-title">Tus materiales</h2>
          <button
            aria-label="Cerrar materiales"
            onClick={() => setMaterialsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          Guardados en este navegador. El material actual se guarda antes de
          cambiar.
        </p>
        <div className="st-template-buttons">
          <button onClick={() => newMaterial("blank")}>
            <Plus size={17} /> En blanco
          </button>
          <button onClick={() => newMaterial("fractions")}>⅔ Fracciones</button>
          <button onClick={() => newMaterial("sequences")}>⋯ Sucesiones</button>
        </div>
        <p className="st-account-line">
          {user ? (
            <button onClick={() => void leaveAccount()}>Cerrar sesión</button>
          ) : (
            <a
              href="#/ingresar"
              onClick={(event) => {
                if (!store.persist()) event.preventDefault();
              }}
            >
              Iniciar sesión
            </a>
          )}
        </p>
        {store.error && (
          <p role="alert" className="st-error">
            {store.error}
          </p>
        )}
        <ul>
          {store.materials.map((item) => (
            <li key={item.id}>
              <button
                className="st-open-material"
                onClick={() => {
                  if (store.open(item.id)) {
                    setMaterialsOpen(false);
                    setSelectedId(null);
                  }
                }}
              >
                <strong>{item.title}</strong>
                <small>
                  {item.id === doc.id
                    ? "Material actual"
                    : new Date(item.updatedAt).toLocaleDateString("es-PE")}
                </small>
              </button>
              {item.id !== doc.id && (
                <button
                  aria-label={`Eliminar material ${item.title}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Eliminar “${item.title}” de este navegador?`,
                      )
                    )
                      store.remove(item.id);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {store.materials.length === 0 && (
          <p>Todavía no hay materiales guardados.</p>
        )}
      </dialog>
    </div>
  );
}

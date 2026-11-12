import { learningIcons } from "../../core/object-registry/learning-registry";
import { TeachingMode } from "./teaching-mode";
import { LessonPlayer } from "./LessonPlayer";
import { agentModes, type AgentMode } from "../../core/agent/protocol";
import { readableBatch, organizeObjects } from "./object-layout";
import { TeachingLevel } from "./teaching-level";
import type { AgentLevel } from "../../core/agent/protocol";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Copy,
  Check,
  Download,
  Expand,
  FolderOpen,
  GraduationCap,
  Layers3,
  Minus,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  UserRound,
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
import { ThemeToggle } from "../theme/ThemeToggle";
import { CanvasViewport } from "./CanvasViewport";
import { PropertiesInspector } from "./PropertiesInspector";
import { useStudioDocument } from "./useStudioDocument";
import { StudioAgentPanel } from "./StudioAgentPanel";
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
  const [moduleFilter, setModuleFilter] = useState("");
  const normalizeModule = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const [mode, setMode] = useState<AgentMode>("learn");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [level, setLevel] = useState<AgentLevel>("primary");
  const [zoom, setZoom] = useState(() =>
    window.innerWidth < 760 ? 0.65 : 1,
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
      data: structuredClone(selected.data),
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
    setNotice("");
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
        setNotice("");
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
    setZoom(window.innerWidth < 760 ? 0.65 : 1);
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
    <TeachingMode.Provider value={mode}><TeachingLevel.Provider value={level}><div ref={root} className={`st-app ${presenting ? "st-presenting" : ""}`}>
      <header className="st-header">
        <a href="#/" className="st-brand" aria-label="Fontex Studio">
          <span>
            <Layers3 size={24} />
          </span>
          <span className="st-wordmark">fontex <small>STUDIO</small></span>
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
          <button className="st-icon-button" aria-label="Abrir materiales" title="Materiales" onClick={() => setMaterialsOpen(true)}>
            <FolderOpen size={18} />
          </button>
          <button className="st-icon-button" aria-label="Guardar" title="Guardar" onClick={() => store.persist()}>
            {store.saved ? <Check size={18} /> : <Save size={18} />}
          </button>
          <ThemeToggle className="st-theme-toggle" />
          <button className="st-primary" aria-label="Recorrer material" title="Recorrer material" disabled={!doc.objects.length} onClick={() => setPlayerOpen(true)}><Expand size={17} /><span className="st-action-label">Recorrer</span></button>
          <button className="st-icon-button" aria-label="Presentar" title="Presentar" onClick={() => void present()}>
            <Expand size={17} />
            <span className="st-action-label">Presentar</span>
          </button>
          {user ? <button className="st-icon-button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void leaveAccount()}><UserRound size={18} /></button>
            : <a className="st-account-link" href="#/ingresar" aria-label="Iniciar sesión" title="Iniciar sesión" onClick={(event) => { if (!store.persist()) event.preventDefault(); }}><UserRound size={18} /></a>}
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
          <h1 className="st-section-label">Objetos</h1>
          <input className="st-module-search" aria-label="Buscar objeto" placeholder="Buscar módulo…" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} />
          <div className="st-add-buttons">
            {(Object.keys(objectRegistry) as ObjectType[]).filter(type => normalizeModule(objectRegistry[type].name).includes(normalizeModule(moduleFilter))).map((type) => (
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
                    { ...learningIcons, polygon: "⬡", factorization: "pⁿ", geometry: "△", fraction: "⅔", operation: "±", text: "T", sequence: "⋯", collection: "#", "number-line": "↔", "linear-equation": "𝑥" }[
                      type
                    ]
                  }
                </span>
                <span>{type === "operation" ? "Operación" : objectRegistry[type].name}</span>
                <Plus size={14} />
              </button>
            ))}
          </div>
          <div className="st-palette-divider" />
          <div className="st-section-label">Archivo</div>
          <div className="st-file-buttons">
            <button onClick={() => { setNotice("En la ventana de impresión, elige Guardar como PDF. Se incluyen todos los objetos y sus explicaciones."); void import("./export-pdf").then(({ exportPDF }) => exportPDF(doc, level)).catch(e => setNotice(e instanceof Error ? e.message : "No se pudo exportar el PDF.")); }}><Download size={17} /> Exportar PDF</button>
            <button onClick={exportDocument}>
              <Download size={17} /> Guardar JSON
            </button>
            <button onClick={() => file.current?.click()}>
              <Upload size={17} /> Importar
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Importar material JSON"
            onChange={(event) => void importDocument(event)}
          />
          <nav className="st-shortcuts" aria-label="Más herramientas">
            <a href={`${import.meta.env.BASE_URL}notices/mathigon.txt`} target="_blank" rel="noopener noreferrer">Créditos de módulos</a>
            <a href="#/demo"><GraduationCap size={17} /> Práctica</a>
            <a href="#/fracciones"><Layers3 size={17} /> Fracciones</a>
          </nav>
        </aside>
        <main
          ref={work}
          className="st-workspace"
          aria-label="Editor del material"
        >
          <div className="st-workspace-heading">
            <span>
              Lienzo
            </span>
            <button className="st-organize" disabled={!doc.objects.length} onClick={() => store.update(current => ({ ...current, objects: organizeObjects(current.objects) }))}>Organizar lienzo</button>
            <span>{doc.objects.length} {doc.objects.length === 1 ? "objeto" : "objetos"}</span>
          </div>
          <div className="st-learning-toolbar"><nav aria-label="Modo del material">{Object.entries(agentModes).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value as AgentMode)}>{label}</button>)}</nav><button className="st-primary" disabled={!doc.objects.length} onClick={() => setPlayerOpen(true)}>Ver como lección</button><small>Pellizca para ampliar · Ctrl + rueda en PC</small></div>
          <CanvasViewport
            objects={doc.objects}
            selectedId={selectedId}
            zoom={zoom}
            onZoom={setZoom}
            presenting={presenting}
            onSelect={setSelectedId}
            onChange={changeObject}
            onDelete={remove}
          />
          <div className="st-canvas-footer">
            <span>{presenting ? doc.title : null}</span>
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
                disabled={zoom >= 2.5}
                onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))}
              >
                <Plus size={16} />
              </button>
              <button aria-label="Ajustar lienzo" onClick={fit}>
                <Expand size={16} />
              </button>
              <button className="st-actual-size" aria-label="Ver al 100 %" title="Ver al 100 %" onClick={() => setZoom(1)}>100 %</button>
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
              <Layers3 size={26} aria-hidden="true" />
              <p>Selecciona un objeto</p>
            </div>
          )}
          <StudioAgentPanel key={`${doc.id}:${mode}`} document={doc} selectedId={selectedId} onSelect={setSelectedId} authenticated={!!user} teachingLevel={level} onLevelChange={setLevel} teachingMode={mode} onModeChange={setMode} onApply={(batch, expected) => {
            const formatted = readableBatch(batch, expected);
            const applied = store.execute(formatted, expected);
            const first = formatted.actions.find(action => action.kind === "create");
            if (applied && first?.kind === "create") setSelectedId(first.object.id);
            return applied;
          }} />
        </aside>
      </div>
      {playerOpen && <LessonPlayer document={doc} onClose={() => setPlayerOpen(false)} />}
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
          <h2 id="st-materials-title">Materiales</h2>
          <button
            aria-label="Cerrar materiales"
            onClick={() => setMaterialsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="st-template-buttons">
          <button onClick={() => newMaterial("blank")}>
            <Plus size={17} /> En blanco
          </button>
          <button onClick={() => newMaterial("fractions")}>⅔ Fracciones</button>
          <button onClick={() => newMaterial("sequences")}>⋯ Sucesiones</button>
        </div>
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
                        `¿Eliminar “${item.title}”?`,
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
          <p>Sin materiales.</p>
        )}
      </dialog>
    </div></TeachingLevel.Provider></TeachingMode.Provider>
  );
}

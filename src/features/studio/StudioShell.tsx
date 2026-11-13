import { useStudioCloud } from "./useStudioCloud";
import { SiteHeader } from "../../components/ProductNavigation";
import { moduleCatalog, moduleGroups, normalizeModule, type ModuleGroup } from "./module-catalog";
import { learningIcons } from "../../core/object-registry/learning-registry";
import { TeachingMode } from "./teaching-mode";
import { LessonPlayer } from "./LessonPlayer";
import { agentLevels, agentModes, type AgentMode } from "../../core/agent/protocol";
import { readableBatch, organizeObjects, wideObject } from "./object-layout";
import { TeachingLevel } from "./teaching-level";
import type { AgentLevel } from "../../core/agent/protocol";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ChevronDown,
  MoreHorizontal,
  MessageCircle,
  Search,
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
  Sparkles,
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
  const cloud = useStudioCloud(owner, store.reload);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState("");
  const [modulesOpen, setModulesOpen] = useState(false);
  const [moduleGroup, setModuleGroup] = useState<ModuleGroup>("all");
  const [assistantOpen, setAssistantOpen] = useState(() => window.innerWidth > 1100);
  const assistantToggle = useRef<HTMLButtonElement>(null);
  const chatLauncher = useRef<HTMLButtonElement>(null);
  const assistantOpener = useRef<HTMLButtonElement | null>(null);
  function openAssistant(opener: HTMLButtonElement) {
    assistantOpener.current = opener;
    setAssistantOpen(true);
    requestAnimationFrame(() => assistantPanel.current?.focus({ preventScroll: true }));
  }
  function closeAssistant() {
    setAssistantOpen(false);
    const opener = assistantOpener.current ?? assistantToggle.current;
    if (opener === chatLauncher.current) requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
    else opener?.focus({ preventScroll: true });
  }
  const assistantPanel = useRef<HTMLElement>(null);
  const matchingModules = (Object.keys(objectRegistry) as ObjectType[]).filter(type => (moduleGroup === "all" || moduleCatalog[type].group === moduleGroup) && normalizeModule(`${objectRegistry[type].name} ${moduleCatalog[type].keywords}`).includes(normalizeModule(moduleFilter)));
  const [mode, setMode] = useState<AgentMode>("learn");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [level, setLevel] = useState<AgentLevel>("primary");
  const [zoom, setZoom] = useState(() =>
    window.innerWidth < 760 ? 0.85 : 1,
  );
  const [canvasLayout, setCanvasLayout] = useState<"flow" | "free">(() => {
    try { return localStorage.getItem("fontex-studio-view") === "free" ? "free" : "flow"; } catch { return "flow"; }
  });
  function changeLayout() {
    const next = canvasLayout === "flow" ? "free" : "flow";
    setCanvasLayout(next); setAutoFit(true);
    try { localStorage.setItem("fontex-studio-view", next); } catch { /* The current view remains usable. */ }
  }
  const [autoFit, setAutoFit] = useState(() => window.innerWidth >= 760);
  const zoomBeforePresentation = useRef(1);
  const [presenting, setPresenting] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const work = useRef<HTMLElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const modulesToggle = useRef<HTMLButtonElement>(null);
  const moduleSearch = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const importBusy = useRef(false);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && root.current?.classList.contains("st-presenting")) {
        setPresenting(false); setZoom(zoomBeforePresentation.current);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      }
    }
    function fullscreen() {
      if (!document.fullscreenElement && root.current?.classList.contains("st-presenting")) { setPresenting(false); setZoom(zoomBeforePresentation.current); }
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

  function changeObject(object: MathObject, inlineEdit = false) {
    store.update((current) => ({
      ...current,
      objects: current.objects.map((item) =>
        item.id === object.id ? object : item,
      ),
    }), inlineEdit);
  }
  function add(type: ObjectType) {
    if (doc.objects.length >= MAX_OBJECTS) {
      setNotice(`Este material admite hasta ${MAX_OBJECTS} objetos.`);
      return;
    }
    const object = wideObject(createObject(type, doc.objects.length));
    const bottom = Math.max(
      0,
      ...doc.objects.map((item) => item.y + item.height),
    );
    const next = fitObject({
      ...object,
      x: 60,
      y: bottom + 30,
    });
    store.update((current) => ({
      ...current,
      objects: [...current.objects, next],
    }));
    setSelectedId(next.id);
    setModulesOpen(false);
    modulesToggle.current?.focus();
    setNotice("");
  }
  function remove(id: string) {
    store.update((current) => ({
      ...current,
      objects: current.objects.filter((object) => object.id !== id),
    }));
    setSelectedId(null);
  }
  function duplicate(selected: MathObject) {
    if (doc.objects.length >= MAX_OBJECTS) return;
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
  useEffect(() => {
    if (canvasLayout === "flow" || !autoFit || presenting) return;
    const element = work.current?.querySelector<HTMLElement>(".st-viewport");
    if (!element) return;
    const resize = () => { if (element.clientWidth) setZoom(Math.max(.2, Math.min(1, (element.clientWidth - 48) / BOARD.width))); };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoFit, presenting, assistantOpen, canvasLayout]);
  function fit() { setAutoFit(true); const width = work.current?.clientWidth; if (width) setZoom(Math.max(.2, Math.min(1, (width - 48) / BOARD.width))); }
  async function present() {
    zoomBeforePresentation.current = zoom;
    setSelectedId(null);
    setPresenting(true);
    try {
      await root.current?.requestFullscreen?.();
    } catch {
      /* The distraction-free view also works without the fullscreen API. */
    }
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
    setZoom(zoomBeforePresentation.current);
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
      <SiteHeader current="lienzo" onNavigate={() => store.persist()} onSignOut={leaveAccount} />
      <header className="st-header">
        <strong className="st-editor-label">Mi material</strong>
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
          <button className="st-icon-button" aria-label="Presentar" title="Presentar" disabled={!doc.objects.length} onClick={() => void present()}>
            <Expand size={17} />
            <span className="st-action-label">Presentar</span>
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
      <div className={`st-layout ${assistantOpen ? "st-with-assistant" : ""}`}>
        <aside className="st-palette" aria-label="Herramientas del editor" onKeyDown={event => { if (event.key === "Escape") { setModulesOpen(false); modulesToggle.current?.focus(); } }}>
          <div className="st-library-toolbar">
            <button ref={modulesToggle} className="st-modules-toggle" aria-expanded={modulesOpen} aria-controls="st-module-catalog" onClick={() => setModulesOpen(open => !open)}>
              <Plus size={19} /><span>Módulos</span><ChevronDown size={17} />
            </button>
            <div className="st-file-buttons">
              <button ref={assistantToggle} className="st-assistant-toggle" aria-label="Asistente" aria-expanded={assistantOpen} aria-controls="st-assistant-panel" onClick={event => { if (assistantOpen) closeAssistant(); else openAssistant(event.currentTarget); }}><Sparkles size={17} /><span>Asistente</span></button>
              <button aria-label="Exportar PDF" onClick={() => { void import("./export-pdf").then(({ exportPDF }) => exportPDF(doc, level)).catch(e => setNotice(e instanceof Error ? e.message : "No se pudo exportar el PDF.")); }}><Download size={17} /><span className="st-export-label">Exportar PDF</span><span className="st-export-compact">PDF</span></button>
              <details className="st-more-options">
                <summary aria-label="Más opciones de archivo" title="Más opciones"><MoreHorizontal size={21} /></summary>
                <div className="st-file-menu">
                  <button onClick={exportDocument}><Download size={17} /> Guardar JSON</button>
                  <button onClick={() => file.current?.click()}><Upload size={17} /> Importar</button>
                  <nav className="st-shortcuts" aria-label="Más herramientas">
                    <a href="#/demo"><GraduationCap size={17} /> Aprender con guías</a>
                    <a href="#/fracciones"><Layers3 size={17} /> Fracciones</a>
                    <a href={`${import.meta.env.BASE_URL}notices/mathigon.txt`} target="_blank" rel="noopener noreferrer">Créditos de módulos</a>
                  </nav>
                </div>
              </details>
            </div>
          </div>
          <div id="st-module-catalog" className="st-module-catalog" hidden={!modulesOpen}>
          <label className="st-module-search-field"><Search size={19} aria-hidden="true" /><input ref={moduleSearch} className="st-module-search" aria-label="Buscar objeto" placeholder="Buscar módulo…" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} /></label>
          <nav className="st-module-groups" aria-label="Categorías de módulos">{Object.entries(moduleGroups).map(([key, label]) => <button key={key} aria-pressed={moduleGroup === key} onClick={() => setModuleGroup(key as ModuleGroup)}>{label}</button>)}</nav>
          <p className="st-catalog-caption">Elige un módulo. Después edita sus valores directamente en el lienzo.</p>
          <div className="st-add-buttons">
            {matchingModules.map((type) => (
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
          {!matchingModules.length && <p className="st-search-empty" role="status">No encontramos ese módulo.</p>}
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Importar material JSON"
            onChange={(event) => void importDocument(event)}
          />
        </aside>
        <main
          ref={work}
          className="st-workspace"
          aria-label="Editor del material"
        >
          <div className="st-learning-toolbar"><nav aria-label="Modo del material">{Object.entries(agentModes).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value as AgentMode)}>{label}</button>)}</nav><label className="st-level-picker"><span>Nivel</span><select aria-label="Nivel del material" value={level} onChange={event => setLevel(event.target.value as AgentLevel)}>{Object.entries(agentLevels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="st-primary" disabled={!doc.objects.length} onClick={() => setPlayerOpen(true)}>Ver como lección</button></div>
          <CanvasViewport
            objects={doc.objects}
            selectedId={selectedId}
            zoom={zoom}
            onZoom={value => { setAutoFit(false); setZoom(value); }}
            presenting={presenting}
            layout={canvasLayout}
            onSelect={setSelectedId}
            onChange={changeObject}
            onInlineChange={object => changeObject(object, true)}
            onDelete={remove}
            onTextGrow={(id, height) => store.relayout(current => {
              const object = current.objects.find(item => item.id === id);
              if (!object || height <= object.height) return current;
              const delta = height - object.height, bottom = object.y + object.height;
              return { ...current, objects: current.objects.map(item => item.id === id ? fitObject({ ...item, height }) : item.y >= bottom && item.x < object.x + object.width && item.x + item.width > object.x ? fitObject({ ...item, y: item.y + delta }) : item) };
            })}
            onAdd={add}
            onBrowse={() => { setModuleFilter(""); setModuleGroup("all"); setModulesOpen(true); requestAnimationFrame(() => moduleSearch.current?.focus()); }}
            onDuplicate={duplicate}
            onBeginEdit={store.beginEdit}
            onEndEdit={store.endEdit}
            onCancelEdit={store.cancelEdit}
          />
          <div className="st-canvas-footer">
            <div className="st-canvas-summary"><span>{presenting ? doc.title : `${doc.objects.length} módulos`}</span>{canvasLayout === "free" && <button className="st-organize" disabled={!doc.objects.length} onClick={() => store.update(current => ({ ...current, objects: organizeObjects(current.objects) }))}>Organizar lienzo</button>}</div>
            <button className="st-layout-toggle" aria-label={canvasLayout === "flow" ? "Cambiar a lienzo libre" : "Cambiar a vista ajustada"} onClick={changeLayout}>{canvasLayout === "flow" ? "Lienzo libre" : "Vista ajustada"}</button>
            {canvasLayout === "free" && <div className="st-zoom">
              <button
                aria-label="Alejar"
                disabled={zoom <= 0.2}
                onClick={() => { setAutoFit(false); setZoom((value) => Math.max(0.2, value - 0.1)); }}
              >
                <Minus size={16} />
              </button>
              <output aria-label="Nivel de zoom">
                {Math.round(zoom * 100)}%
              </output>
              <button
                aria-label="Acercar"
                disabled={zoom >= 2.5}
                onClick={() => { setAutoFit(false); setZoom((value) => Math.min(2.5, value + 0.1)); }}
              >
                <Plus size={16} />
              </button>
              <button aria-label="Ajustar lienzo" onClick={fit}>
                <Expand size={16} />
              </button>
              <button className="st-actual-size" aria-label="Ver al 100 %" title="Ver al 100 %" onClick={() => { setAutoFit(false); setZoom(1); }}>100 %</button>
            </div>}
          </div>
        </main>
        <aside ref={assistantPanel} id="st-assistant-panel" hidden={!assistantOpen} tabIndex={-1} className="st-inspector" aria-label="Asistente del material" onKeyDown={event => { if (event.key === "Escape") { closeAssistant(); } }}>
          <div className="st-assistant-heading"><span>Chat</span><button aria-label="Cerrar asistente" onClick={() => { closeAssistant(); }}><X size={18} /></button></div>
          <p className="st-sync-status" role="status">{cloud.status === "saved" ? "Guardado en tu cuenta" : cloud.status === "saving" || cloud.status === "loading" ? "Sincronizando…" : cloud.status === "offline" ? "Sin conexión · guardado en este dispositivo" : cloud.status === "error" ? "Sincronización pendiente" : "Guardado en este dispositivo"}</p>
          {cloud.notice && <p className="st-sync-notice">{cloud.notice}</p>}
          <StudioAgentPanel key={doc.id} conversation={cloud.conversations[doc.id] ?? []} onConversationChange={turns => { cloud.setConversation(doc.id, turns, store.persist()); }} document={doc} selectedId={selectedId} onSelect={setSelectedId} authenticated={!!user} teachingLevel={level} onLevelChange={setLevel} teachingMode={mode} onModeChange={setMode} onApply={(batch, expected) => {
            const formatted = readableBatch(batch, expected);
            const applied = store.execute(formatted, expected);
            const first = formatted.actions.find(action => action.kind === "create");
            if (applied && first?.kind === "create") setSelectedId(first.object.id);
            return applied;
          }} />
        </aside>
      </div>
      {!presenting && <button ref={chatLauncher} type="button" className="st-chat-launcher" hidden={assistantOpen} aria-label="Abrir chat" aria-expanded={assistantOpen} aria-controls="st-assistant-panel" onClick={event => openAssistant(event.currentTarget)}><MessageCircle size={22} aria-hidden="true" /><span>Chat</span></button>}
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

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useAiCredits } from "./useAiCredits";
import {
  type CreditAccount,
  type CreditEvent,
  creditHistory,
  creditsChanged,
  grantCredits,
  listCreditAccounts,
} from "./service";
import "./credits.css";
import { BetaAdminPanel } from "../beta/BetaAdminPanel";
import { AdminMfaGate } from "../auth/AdminMfaGate";
import { CanvasDiagnostics } from "../beta/CanvasDiagnostics";
const eventNames = {
  initial: "Créditos iniciales",
  grant: "Créditos asignados",
  reserve: "Generación reservada",
  complete: "Generación completada",
  refund: "Crédito devuelto",
};
function CreditAdministration() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [accounts, setAccounts] = useState<CreditAccount[]>([]),
    [hasMore, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<CreditAccount | null>(null),
    [amount, setAmount] = useState(5),
    [reason, setReason] = useState("Asignación manual"),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [events, setEvents] = useState<CreditEvent[]>([]),
    [historyError, setHistoryError] = useState("");
  const grantRequest = useRef<{ key: string; id: string } | null>(null),
    listSequence = useRef(0);
  const load = useCallback(() => {
    const current = ++listSequence.current;
    return listCreditAccounts(query,offset).then(result=>{
      if(current===listSequence.current){setError("");setAccounts(result.accounts);setMore(result.hasMore);}
    }).catch((e:unknown)=>{
      if(current===listSequence.current)setError(e instanceof Error?e.message:"No se pudieron cargar las cuentas.");
    }).finally(()=>{if(current===listSequence.current)setLoading(false);});
  },[query,offset]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let active = true;
    if (!selected) return;
    void creditHistory(selected.user_id).then((items) => {
      if (active) {
        setEvents(items);
        setHistoryError("");
      }
    }).catch(() => {
      if (active) setHistoryError("No se pudo cargar el historial.");
    });
    return () => {
      active = false;
    };
  }, [selected]);
  async function assign(e: FormEvent) {
    e.preventDefault();
    if (!selected || pending) return;
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
      setError("Asigna entre 1 y 1000 créditos.");
      return;
    }
    const key = JSON.stringify([selected.user_id, amount, reason]);
    if (grantRequest.current?.key !== key) {
      grantRequest.current = { key, id: crypto.randomUUID() };
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await grantCredits(
        selected.user_id,
        amount,
        reason,
        grantRequest.current.id,
      );
      setMessage(
        `Asignación confirmada. Saldo de ${
          selected.email ?? selected.display_name
        }: ${result.balance} créditos.`,
      );
      setSelected({ ...selected, credits: result.balance });
      grantRequest.current = null;
      creditsChanged();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo asignar el crédito.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="ai-credit-admin p-5 sm:p-7">
      <p className="eyebrow">Administración de IA</p>
      <h2 className="mt-2 text-xl font-semibold">Créditos de generación</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cada cuenta empieza con 5 generaciones. Puedes añadir saldo a cualquier
        cuenta, incluida la tuya.
      </p>
      <form
        className="ai-account-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSelected(null);
          setMessage("");
          setQuery(search.trim());
          setOffset(0);
        }}
      >
        <label className="form-field">
          <span>Buscar por correo o nombre</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={loading}>Buscar cuenta</Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          Actualizar
        </Button>
      </form>
      {error && <p role="alert" className="ai-credit-error">{error}</p>}
      {message && <p role="status" className="ai-credit-success">{message}</p>}
      {loading
        ? <p role="status">Cargando cuentas…</p>
        : (
          <div className="ai-account-list">
            {accounts.map((account) => (
              <button
                key={account.user_id}
                type="button"
                className="ai-account-row"
                disabled={pending}
                aria-pressed={selected?.user_id === account.user_id}
                onClick={() => {
                  setSelected(account);
                  setEvents([]);
                  setHistoryError("");
                  setMessage("");
                }}
              >
                <span>
                  <strong>{account.display_name}</strong>
                  <small>
                    {account.email ?? "Cuenta sin correo"}
                    {account.is_admin ? " · Administrador" : ""}
                  </small>
                </span>
                <span>{account.credits} créditos</span>
              </button>
            ))}
            {!accounts.length && <p>No hay cuentas que coincidan.</p>}
          </div>
        )}
      <div className="ai-account-pagination">
        <Button
          type="button"
          variant="secondary"
          disabled={loading || offset === 0}
          onClick={() => {
            setOffset(Math.max(0, offset - 25));
            setSelected(null);
          }}
        >
          Anterior
        </Button>
        <span>Página {offset / 25 + 1}</span>
        <Button
          type="button"
          variant="secondary"
          disabled={loading || !hasMore}
          onClick={() => {
            setOffset(offset + 25);
            setSelected(null);
          }}
        >
          Siguiente
        </Button>
      </div>
      {selected && (
        <section aria-label="Asignar créditos">
          <h3>Asignar a {selected.email ?? selected.display_name}</h3>
          <p>
            Saldo disponible: <strong>{selected.credits}</strong>
          </p>
          <form className="ai-grant-form" onSubmit={(e) => void assign(e)}>
            <label className="form-field">
              <span>Créditos a añadir</span>
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                required
                value={amount}
                disabled={pending}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            <label className="form-field">
              <span>Motivo de la asignación</span>
              <input
                maxLength={200}
                value={reason}
                disabled={pending}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Asignando…" : "Añadir créditos"}
            </Button>
          </form>
          <h3>Últimos movimientos</h3>
          {historyError && <p role="alert">{historyError}</p>}
          <ul className="ai-credit-history">
            {events.map((event) => (
              <li key={event.id}>
                <span>
                  {eventNames[event.kind]}
                  <small>
                    {event.reason} ·{" "}
                    {new Date(event.created_at).toLocaleString("es-PE")}
                  </small>
                </span>
                <strong>
                  {event.delta > 0 ? "+" : ""}
                  {event.delta} · saldo {event.balance_after}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
export function AiCreditPanel() {
  const { status, error, refresh } = useAiCredits();
  return (
    <div className="ai-credit-section">
      <Card className="p-5 sm:p-7">
        <p className="eyebrow">Uso de IA</p>
        <h2 className="mt-2 text-xl font-semibold">Tu saldo de generaciones</h2>
        <p className="ai-credit-balance">
          {status
            ? `${status.balance} créditos disponibles`
            : error ?? "Consultando saldo…"}
        </p>
        <p>
          Chat sin cobro, con límites temporales de uso. Crear en el lienzo consume 1 crédito por
          propuesta válida completada.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Recibes 5 créditos iniciales, sin renovación automática. Los fallos
          antes de completar una generación devuelven el crédito. Las plantillas
          y la edición manual no consumen saldo.
        </p>
        {error && (
          <Button variant="secondary" onClick={() => void refresh()}>
            Reintentar saldo
          </Button>
        )}
        <a href="#/lienzo">Ir al lienzo</a>
      </Card>
      {status?.is_admin && <AdminMfaGate><CreditAdministration /><BetaAdminPanel /><CanvasDiagnostics /></AdminMfaGate>}
    </div>
  );
}

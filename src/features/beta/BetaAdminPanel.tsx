import { type FormEvent, useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../lib/supabase/client";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
const schema = z.object({
  ai_enabled: z.boolean(),
  members: z.array(
    z.object({
      user_id: z.uuid(),
      email: z.string().nullable(),
      active: z.boolean(),
    }),
  ),
  invitations: z.array(z.object({ email: z.string(), expires_at: z.string() })),
});
export function BetaAdminPanel() {
  const [value, setValue] = useState<z.infer<typeof schema> | null>(null),
    [email, setEmail] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.rpc("admin_beta_overview");
    const parsed = schema.safeParse(result.data);
    if (result.error || !parsed.success) {
      throw Error("No se pudo cargar la administración de la beta.");
    }
    setValue(parsed.data);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch(() =>
        setError("No se pudo cargar la administración de la beta.")
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  async function mutate(
    action: () => PromiseLike<{ error: unknown }>,
    success: string,
  ) {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result.error) throw Error();
      await refresh();
      setMessage(success);
    } catch {
      setError(
        "No se pudo completar la operación. Revisa tus permisos y vuelve a intentar.",
      );
    } finally {
      setPending(false);
    }
  }
  function invite(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const client = supabase;
    void mutate(
      () => client.rpc("admin_invite_beta", { p_email: email.trim() }),
      "Acceso autorizado. Comparte el enlace de registro con la persona invitada; Fontex no envía un correo desde este panel.",
    );
  }
  return (
    <Card className="p-5 sm:p-7 space-y-4">
      <h2 className="text-xl font-semibold">Participantes de la beta</h2>
      <form className="space-y-3" onSubmit={invite}>
        <label className="form-field">
          <span>Correo de la persona invitada</span>
          <input
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </label>
        <Button type="submit" disabled={pending}>Autorizar acceso</Button>
      </form>
      <p className="text-sm">
        Cada invitación nueva dura 30 días y permite un registro con ese correo.
        Las cuentas existentes se habilitan por su identificador.
      </p>
      <a href="#/crear-cuenta" className="text-primary underline">
        Enlace de registro de participantes
      </a>
      {value && (
        <>
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => {
              if (supabase) {
                const client = supabase;
                void mutate(
                  () =>
                    client.rpc("admin_set_beta_ai_enabled", {
                      p_enabled: !value.ai_enabled,
                    }),
                  "Disponibilidad de IA actualizada.",
                );
              }
            }}
          >
            {value.ai_enabled ? "Pausar toda la IA" : "Reanudar la IA"}
          </Button>
          <p role="status">
            IA{" "}
            {value.ai_enabled ? "disponible" : "pausada"}. El lienzo local sigue
            disponible.
          </p>
          <ul className="space-y-2">
            {value.members.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3">
                <span>
                  {m.email ?? m.user_id} · {m.active ? "Activo" : "Revocado"}
                </span>
                {m.active && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      if (supabase) {
                        const client = supabase;
                        void mutate(
                          () =>
                            client.rpc("admin_revoke_beta", {
                              p_user_id: m.user_id,
                            }),
                          "Acceso revocado.",
                        );
                      }
                    }}
                  >
                    Revocar acceso
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p>Invitaciones pendientes: {value.invitations.length}</p>
          <ul>
            {value.invitations.map((i) => (
              <li key={i.email}>
                {i.email} · vence{" "}
                {new Date(i.expires_at).toLocaleDateString("es")}
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </Card>
  );
}

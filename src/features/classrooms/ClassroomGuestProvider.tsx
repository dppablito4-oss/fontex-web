import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { readClassroomGuest, storeClassroomGuest } from "./classroom-access";
import { GuestContext, useClassroomGuest } from "./classroom-guest-context";

export function ClassroomGuestProvider({ children }: { children: ReactNode }) {
  const [guest, setGuest] = useState(readClassroomGuest);
  const [verified, setVerified] = useState("");
  const [checking, setChecking] = useState(!!guest);
  useEffect(() => {
    const update = () => { setGuest(readClassroomGuest()); setVerified(""); };
    window.addEventListener("fontex-classroom-guest", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("fontex-classroom-guest", update); window.removeEventListener("storage", update); };
  }, []);
  useEffect(() => {
    if (!guest || !supabase) return;
    let alive = true;
    const check = async () => {
      const { data, error } = await supabase!.rpc("get_classroom_guest", { p_token: guest.token });
      if (!alive) return;
      setChecking(false);
      if (!error) setVerified(data && Date.parse(guest.expires_at) > Date.now() ? guest.token : "");
    };
    const update = () => { void check().catch(() => { if (alive) setChecking(false); }); };
    update();
    const timer = window.setInterval(update, 30000);
    const expiry = window.setTimeout(() => setVerified(""), Math.max(0, Date.parse(guest.expires_at) - Date.now()));
    window.addEventListener("focus", update);
    return () => { alive = false; clearInterval(timer); clearTimeout(expiry); window.removeEventListener("focus", update); };
  }, [guest]);
  return <GuestContext value={{ guest, active: !!guest && verified === guest.token, checking }}>{children}</GuestContext>;
}

export function ClassroomGuestBanner() {
  const { guest, active, checking } = useClassroomGuest();
  if (!guest) return null;
  return <div className="pc-guest-banner">
    <span><strong>{guest.display_name}</strong> · {guest.title} · {checking ? "Comprobando acceso…" : active ? "Participación temporal" : "Acceso temporal finalizado"}</span>
    <a href="#/unirse?conservar=1">Guardar y permanecer en el aula</a>
    <button aria-label="Salir del aula temporal" onClick={() => { storeClassroomGuest(null); window.location.hash = "/unirse"; }}>Salir</button>
  </div>;
}

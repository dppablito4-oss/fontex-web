import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
export function PersonalCanvases({ owner }: { owner: string }) {
  const [scenes,setScenes] = useState<{id:string;scene_title:string|null}[]>([]), [error,setError] = useState(""), [loading,setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    async function load() {
      if(!supabase) { if(alive) setLoading(false); return; }
      try {
        const rows: typeof scenes = [];
        for(let offset=0;;offset+=25) {
          const result = await supabase.from("visual_scenes").select("id,scene_title").eq("user_id",owner).eq("scene->>format","primitive-scene").order("updated_at",{ascending:false}).range(offset,offset+24);
          if(result.error) throw result.error;
          rows.push(...result.data);
          if(result.data.length<25) break;
        }
        if(alive) setScenes(rows);
      } catch { if(alive) setError("No se pudieron cargar tus lienzos. Vuelve a abrir la biblioteca."); }
      finally { if(alive) setLoading(false); }
    }
    void load(); return () => { alive=false; };
  },[owner]);
  return <section className="mt-8 rounded-xl border border-border p-5" aria-label="Mis lienzos personales">
    <h2 className="text-lg font-semibold">Mis lienzos personales</h2>
    <p className="mt-2 text-sm text-muted-foreground">Tus lienzos guardados en la cuenta, con sus figuras, textos y variables.</p>
    {loading ? <p role="status">Cargando lienzos…</p> : error ? <p role="alert">{error}</p> : scenes.length ? <ul className="mt-4 grid gap-2">
      {scenes.map(s => <li key={s.id}><a className="text-primary underline" href={`#/lienzo?abrir=${encodeURIComponent(s.id)}`}>{s.scene_title || "Sin título"}</a></li>)}
    </ul> : <p className="mt-4">Todavía no tienes lienzos guardados.</p>}
  </section>;
}

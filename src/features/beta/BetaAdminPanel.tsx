import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
export function BetaAdminPanel() {
  const [enabled,setEnabled]=useState<boolean|null>(null),[pending,setPending]=useState(false),[error,setError]=useState("");
  const refresh=useCallback(async()=>{
    if(!supabase)return;
    const {data,error}=await supabase.rpc("admin_beta_overview");
    if(error||!data||typeof data!=="object"||Array.isArray(data)||typeof data.ai_enabled!=="boolean")throw Error("No se pudo consultar la disponibilidad de IA.");
    setEnabled(data.ai_enabled);
  },[]);
  useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{void refresh().catch((e:unknown)=>{if(active)setError(e instanceof Error?e.message:"No se pudo consultar la disponibilidad de IA.");});},0);return()=>{active=false;window.clearTimeout(timer);};},[refresh]);
  async function toggle(){
    if(!supabase||enabled===null||pending)return;
    setPending(true);setError("");
    try {const {error}=await supabase.rpc("admin_set_beta_ai_enabled",{p_enabled:!enabled});if(error)throw Error("No se pudo cambiar la disponibilidad de IA.");await refresh();}
    catch(e){setError(e instanceof Error?e.message:"No se pudo cambiar la disponibilidad de IA.");}
    finally{setPending(false);}
  }
  return <Card className="p-5 sm:p-7 space-y-4"><h2 className="text-xl font-semibold">Disponibilidad de IA</h2>
    {enabled!==null&&<><Button disabled={pending} variant="secondary" onClick={()=>void toggle()}>{enabled?"Pausar toda la IA":"Reanudar la IA"}</Button><p role="status">IA {enabled?"disponible":"pausada"}. El lienzo y la edición manual siguen disponibles.</p></>}
    {error&&<p role="alert">{error}</p>}
  </Card>;
}

"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveAccess } from "./actions";
function Submit({enabled}:{enabled:boolean}) { const {pending}=useFormStatus(); return <button className="btn" disabled={pending} type="submit">{pending ? "保存中…" : enabled ? "許可を取り消す" : "利用を許可"}</button>; }
export default function AccessForm({store}:{store:{id:string;name:string;enabled:boolean}}) {
    const [state,action]=useFormState(saveAccess,{ok:false,message:""});
    const enabled=state.ok ? state.enabled === true : store.enabled;
    return <form action={action} style={{display:"grid",gap:10,padding:14,border:"1px solid #ddd",borderRadius:8}}>
        <strong>{store.name}</strong><span>オンライン大会設定：{enabled ? "許可済み" : "未許可"}</span>
        <input type="hidden" name="store_id" value={store.id}/><input type="hidden" name="enabled" value={String(!enabled)}/>
        <div><Submit enabled={enabled}/></div>{state.message && <p role="status">{state.message}</p>}
    </form>;
}

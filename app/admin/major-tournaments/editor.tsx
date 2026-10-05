"use client";
import { useFormState,useFormStatus } from "react-dom";
import { saveTournament } from "./actions";
function Buttons(){const {pending}=useFormStatus();return <div style={{display:"flex",gap:8}}><button className="btn" name="intent" value="draft" disabled={pending}>下書き保存</button><button className="btn primary" name="intent" value="publish" disabled={pending}>公開する</button></div>;}
export function TournamentEditor({entry}:{entry?:{id:string;title:string;scope:string;location:string;venue:string;start_date:string|null;end_date:string|null;description:string;schedule:string;official_url:string}}){
 const [state,action]=useFormState(saveTournament,{} as {error?:string;success?:string;id?:string});
 return <form action={action} className="card" style={{display:"grid",gap:14}}>
 <input type="hidden" name="id" value={state.id||entry?.id||""}/>
 <label>大会名 *<input name="title" required maxLength={160} defaultValue={entry?.title}/></label>
 <label>開催区分<select name="scope" defaultValue={entry?.scope||"国内"}><option>国内</option><option>海外</option></select></label>
 <label>国・地域<input name="location" maxLength={200} defaultValue={entry?.location}/></label>
 <label>会場<input name="venue" maxLength={300} defaultValue={entry?.venue}/></label>
 <label>開催開始日<input type="date" name="start_date" defaultValue={entry?.start_date||""}/></label>
 <label>開催終了日<input type="date" name="end_date" defaultValue={entry?.end_date||""}/></label>
 <label>大会詳細<textarea name="description" rows={5} maxLength={10000} defaultValue={entry?.description}/></label>
 <label>スケジュール（開催地の現地時間） *<textarea name="schedule" rows={12} maxLength={20000} defaultValue={entry?.schedule} placeholder={"10/10 12:00 メインイベント Day 1A\n10/11 12:00 メインイベント Day 1B\n参加費・開始時刻・会場などを記載できます。"}/></label>
 <label>公式URL<input type="url" name="official_url" maxLength={2048} defaultValue={entry?.official_url}/></label>
 {state.error&&<p className="err" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
 <Buttons/>
 </form>;
}

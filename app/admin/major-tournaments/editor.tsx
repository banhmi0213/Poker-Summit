"use client";
import { useFormState,useFormStatus } from "react-dom";
import { saveTournament } from "./actions";
function Buttons(){const {pending}=useFormStatus();return <div style={{display:"flex",gap:8}}><button className="btn" name="intent" value="draft" disabled={pending}>下書き保存</button><button className="btn primary" name="intent" value="publish" disabled={pending}>公開する</button></div>;}
export function TournamentEditor({entry}:{entry?:{id:string;title:string;scope:string;location:string;venue:string;start_date:string|null;end_date:string|null;description:string;schedule:string;official_url:string}}){
 const [state,action]=useFormState(saveTournament,{} as {error?:string;success?:string;id?:string});
 return <form action={action} className="card tournament-editor">
 <input type="hidden" name="id" value={state.id||entry?.id||""}/>
 <label className="wide">大会名 *<input name="title" required maxLength={160} defaultValue={entry?.title} placeholder="例：JAPAN POKER FESTIVAL 2026"/></label>
 <label>開催区分<select name="scope" defaultValue={entry?.scope||"国内"}><option>国内</option><option>海外</option></select></label>
 <label>国・地域<input name="location" maxLength={200} defaultValue={entry?.location} placeholder="例：日本・東京／フィリピン・マニラ"/></label>
 <label>会場<input name="venue" maxLength={300} defaultValue={entry?.venue} placeholder="会場名を入力"/></label>
 <label>開催開始日<input type="date" name="start_date" defaultValue={entry?.start_date||""}/></label>
 <label>開催終了日<input type="date" name="end_date" defaultValue={entry?.end_date||""}/></label>
 <label className="wide">大会詳細<textarea name="description" rows={7} maxLength={10000} defaultValue={entry?.description}/></label>
 <label className="wide">スケジュール（開催地の現地時間） *<textarea name="schedule" rows={14} maxLength={20000} defaultValue={entry?.schedule} placeholder={"10/10 12:00 メインイベント Day 1A\n10/11 12:00 メインイベント Day 1B\n参加費・開始時刻・会場などを記載できます。"}/></label>
 <label className="wide">公式URL<input type="url" name="official_url" maxLength={2048} defaultValue={entry?.official_url} placeholder="https://"/></label>
 {state.error&&<p className="err" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
 <div className="wide"><p className="hint">下書きでは未完成の内容も保存できます。公開する前に、日程とスケジュールをご確認ください。</p><Buttons/></div>
 <style jsx>{`
 .tournament-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 24px;padding:26px;align-items:start}
 .tournament-editor label{display:flex;flex-direction:column;gap:8px;min-width:0;font-size:14px;font-weight:600;color:#49351e}
 .wide,.tournament-editor>p{grid-column:1/-1}
 .tournament-editor input:not([type="hidden"]),.tournament-editor select,.tournament-editor textarea{display:block;width:100%;max-width:none;box-sizing:border-box;margin:0;border:1px solid #d9c5a4;border-radius:7px;background:#faf7ef;padding:11px 13px;font:inherit;font-weight:400;color:#382b1e;min-height:44px}
 .tournament-editor textarea{resize:vertical;line-height:1.8;min-height:180px}
 .tournament-editor textarea[name="schedule"]{min-height:320px}
 .tournament-editor input:focus,.tournament-editor select:focus,.tournament-editor textarea:focus{outline:2px solid #cba43c;outline-offset:2px}
 .hint{font-size:12px;line-height:1.7;color:#8a7758;margin:0 0 14px}
 @media(max-width:700px){.tournament-editor{grid-template-columns:minmax(0,1fr);padding:18px;gap:20px}.tournament-editor input:not([type="hidden"]),.tournament-editor select,.tournament-editor textarea{font-size:16px}}
 `}</style>
 </form>;
}

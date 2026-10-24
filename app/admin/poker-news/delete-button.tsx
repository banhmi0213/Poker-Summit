"use client";
import { useState } from "react";
import { useFormState,useFormStatus } from "react-dom";
import { deletePokerNews } from "./actions";
function ConfirmDelete(){const {pending}=useFormStatus();return <button type="submit" className="btn" disabled={pending} style={{color:"#a22e22",borderColor:"#dcaaa2"}}>{pending?"削除中…":"削除する"}</button>;}
export function DeleteNewsButton({id,title}:{id:string;title:string}){
 const [confirming,setConfirming]=useState(false);
 const [state,action]=useFormState(deletePokerNews,{});
 return <div>{!confirming?<button type="button" className="btn" aria-label={`${title}を削除`} onClick={()=>setConfirming(true)} style={{color:"#a22e22",borderColor:"#dcaaa2"}}>削除</button>:<form action={action} data-no-draft style={{maxWidth:440}}><input type="hidden" name="id" value={id}/><input type="hidden" name="confirmation" value="delete"/><p style={{margin:"0 0 8px",fontSize:12}}>「{title}」を削除します。元に戻せません。関連記事のブログは削除されません。</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><ConfirmDelete/><button className="btn" type="button" onClick={()=>setConfirming(false)}>キャンセル</button></div></form>}{state.error&&<p className="err" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</div>;
}

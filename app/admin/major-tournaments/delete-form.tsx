"use client";
import { useFormState, useFormStatus } from "react-dom";
import { deleteTournament } from "./actions";

function DeleteButton() {
 const { pending } = useFormStatus();
 return <button type="submit" className="btn" disabled={pending} style={{color:"#a33b2d",borderColor:"#d9aaa2"}}>{pending?"削除中…":"削除"}</button>;
}
export function TournamentDelete({id,title}:{id:string;title:string}) {
 const [state,action]=useFormState(deleteTournament,{});
 return <form action={action} onSubmit={event=>{
   if(!window.confirm(`「${title}」を削除しますか？公開ページからも削除されます。この操作は取り消せません。`))event.preventDefault();
 }} style={{display:"inline-block"}}>
  <input type="hidden" name="id" value={id}/>
  <DeleteButton/>
  {state.error&&<p role="alert" className="err">{state.error}</p>}
 </form>;
}

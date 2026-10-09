"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createBrowserClient} from "@supabase/ssr";
import {STORE_AUTH_COOKIE_NAME} from "@/lib/constants";
import styles from "./chat.module.css";

export function LiveChat({actor,record}:{actor:"store"|"dealer";record:string}){
 const router=useRouter();
 const [connected,setConnected]=useState(false);
 useEffect(()=>{
  let active=true,live=false;
  let queued:ReturnType<typeof setTimeout>|undefined;
  const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{isSingleton:false,...(actor==="store"?{cookieOptions:{name:STORE_AUTH_COOKIE_NAME}}:{})});
  const refresh=()=>{if(!active)return;if(document.visibilityState!=="visible"){return;}if(queued)return;queued=setTimeout(()=>{queued=undefined;if(active){router.refresh();}},100);};
  const channel=db.channel(`spot-chat:${actor}:${record}`)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"dealer_chat_messages",filter:`record_id=eq.${record}`},refresh)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"dealer_matching_records",filter:`id=eq.${record}`},refresh)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"dealer_chat_terms",filter:`record_id=eq.${record}`},refresh)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"dealer_chat_terms",filter:`record_id=eq.${record}`},refresh)
   .subscribe(status=>{if(!active)return;live=status==="SUBSCRIBED";setConnected(live);if(live)refresh();});
  let ticks=0;
  // Reconcile after reconnects and changes without a realtime event; poll faster if disconnected.
  const timer=setInterval(()=>{ticks++;if(!live||ticks%4===0)refresh();},15000);
  const resume=()=>{if(document.visibilityState==="visible"){refresh();}};
  document.addEventListener("visibilitychange",resume);window.addEventListener("online",resume);
  return()=>{active=false;clearInterval(timer);if(queued)clearTimeout(queued);document.removeEventListener("visibilitychange",resume);window.removeEventListener("online",resume);void db.removeChannel(channel);db.auth.stopAutoRefresh();};
 },[actor,record,router]);
 return <p className={styles.muted} role="status">{connected?"リアルタイム受信中・メッセージは自動で表示されます。":"接続中・履歴は自動更新されます。手動での更新は不要です。"}</p>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import type {RoomAssignment} from '@/lib/poker/room-directory';
export default function AssignedRooms({enabled}:{enabled:boolean}){
 const [page,setPage]=useState(0);
 const [rooms,setRooms]=useState<RoomAssignment[]>([]),[message,setMessage]=useState('参加卓を確認しています。'),[busy,setBusy]=useState(false),epoch=useRef(0),loading=useRef(false),mounted=useRef(false);
 async function refresh(){if(!enabled||loading.current)return;loading.current=true;setBusy(true);setRooms([]);const current=++epoch.current;
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw Error();
   const response=await fetch('/api/poker/lobby',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:'{"type":"assignments"}',signal:AbortSignal.timeout(10000)}),body=await response.json();
   if(!response.ok||body?.ok!==true||!Array.isArray(body.result))throw Error();
   if(mounted.current&&current===epoch.current){setRooms(body.result);setMessage(body.result.length?'割り当てられた卓へ進み、参加・接続ボタンを押してください。':'現在、割り当てられた参加卓はありません。');}
  }catch{if(mounted.current&&current===epoch.current)setMessage('参加卓を確認できません。ログイン状態を確認し、再読み込みしてください。');}
  finally{if(current===epoch.current){loading.current=false;if(mounted.current)setBusy(false);}}
 }
 useEffect(()=>{mounted.current=true;if(!enabled)return()=>{mounted.current=false;};
  const supabase=createClient();let member:string|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{const next=session?.user.id??'';if(event==='SIGNED_OUT'||member!==undefined&&member!==next){epoch.current++;loading.current=false;setBusy(false);setRooms([]);setMessage('ログイン状態が変わりました。参加卓を再読み込みしてください。');}member=next;});
  void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>{clearInterval(timer);mounted.current=false;epoch.current++;loading.current=false;subscription.unsubscribe();};
 },[enabled]);
 const pages=Math.max(1,Math.ceil(rooms.length/2)),current=Math.min(page,pages-1);
 return <section aria-label="割り当て済みの参加卓" style={{padding:16,border:'1px solid #a4c6b7',borderRadius:12,marginBottom:20}}><h2>あなたの参加卓</h2>
  <p role="status">{enabled?message:'オンライン対戦は準備中です。現在は下のデモをご利用ください。'}</p>
  {enabled&&<button className="btn" disabled={busy} onClick={()=>void refresh()}>参加卓を再読み込み</button>}
  {rooms.slice(current*2,current*2+2).map(room=><article key={room.roomId} style={{padding:'16px 0',borderBottom:'1px solid #d5e4dc'}}><h3>{room.title}</h3><p>{room.capacity}人卓 · {new Date(room.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（日本時間）</p>{!room.published&&<p>新規着席は停止中です。着席済みの方は再接続できます。</p>}<a className="btn" href={`/poker-online/${room.roomId}`}>割り当て卓へ進む</a></article>)}
 {pages>1&&<nav aria-label="参加卓のページ"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>前へ</button> {current+1} / {pages} <button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>次へ</button></nav>}
 </section>;
}

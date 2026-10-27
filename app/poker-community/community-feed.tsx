'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import styles from './community.module.css';
type Post={id:string;title?:string;body:string;author_name:string;created_at:string};
type Receipt={type:'post';id:string;title:string;body:string}|{type:'reply';id:string;postId:string;body:string};
export function CommunityFeed(){
 const [posts,setPosts]=useState<Post[]>([]),[post,setPost]=useState<Post|null>(null),[replies,setReplies]=useState<Post[]>([]),[selected,setSelected]=useState<string|null>(null),[title,setTitle]=useState(''),[body,setBody]=useState(''),[message,setMessage]=useState('掲示板を同期しています。'),[busy,setBusy]=useState(false),[authorized,setAuthorized]=useState(false),[receipt,setReceipt]=useState<Receipt|null>(null);
 const epoch=useRef(0),reading=useRef(false),mounted=useRef(false),sending=useRef(false);
 async function refresh(){if(reading.current)return;reading.current=true;const current=epoch.current;
  try{const response=await fetch('/api/poker/community'+(selected?'?post='+selected:''),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)}),data=await response.json();if(!mounted.current||current!==epoch.current)return;
   if(!response.ok){if(response.status===401||response.status===404){if(response.status===401)setAuthorized(false);setPosts([]);setPost(null);setReplies([]);}throw Error(data.error||'同期できません。');}
   setAuthorized(true);if(selected){setPost(data.post);setReplies(data.replies??[]);}else{setPosts(data.posts??[]);setPost(null);setReplies([]);}setMessage('15秒ごとに同期します。');
  }catch(error){if(mounted.current&&current===epoch.current)setMessage(error instanceof Error?error.message:'同期できません。');}finally{if(current===epoch.current)reading.current=false;}
 }
 useEffect(()=>{mounted.current=true;epoch.current++;reading.current=false;void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>{mounted.current=false;epoch.current++;clearInterval(timer);};},[selected]);
 useEffect(()=>{const client=createClient();let member:string|undefined;const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{const next=session?.user.id??'';if(event==='SIGNED_OUT'||member!==undefined&&member!==next){epoch.current++;reading.current=false;setAuthorized(false);setPosts([]);setPost(null);setReplies([]);setBody('');setTitle('');setReceipt(null);setMessage('ログイン状態が変わりました。再読み込みしてください。');}member=next;});return()=>subscription.unsubscribe();},[]);
 async function send(){if(sending.current||!authorized)return;const packet=receipt??(selected?{type:'reply' as const,id:crypto.randomUUID(),postId:selected,body}:{type:'post' as const,id:crypto.randomUUID(),title,body});const current=epoch.current;sending.current=true;setBusy(true);setReceipt(packet);
  try{const response=await fetch('/api/poker/community',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet),signal:AbortSignal.timeout(10000)}),data=await response.json();if(!mounted.current||current!==epoch.current)return;if(!response.ok){if(response.status>=400&&response.status<500){setReceipt(null);if(response.status===401)setAuthorized(false);}throw Error(data.error||'送信結果を確認できません。');}
   setReceipt(null);setBody('');setTitle('');setMessage('投稿しました。');if(packet.type==='post')setSelected(packet.id);else await refresh();
  }catch(error){if(mounted.current&&current===epoch.current)setMessage(error instanceof Error?error.message:'送信結果を確認できません。同じ内容で再確認してください。');}finally{sending.current=false;if(mounted.current){setBusy(false);}}
 }
 function choose(id:string|null){if(busy||receipt)return;epoch.current++;setPost(null);setReplies([]);setSelected(id);}
 const format=(s:string)=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return <main className={styles.feed}><header><div><strong>サミット掲示板</strong><small>POKER SUMMIT COMMUNITY</small></div><a href="/board" target="_blank" rel="noopener noreferrer" aria-label="掲示板を別タブで開く">↗</a></header>
 <div className={styles.tools}>{selected&&<button type="button" disabled={busy||Boolean(receipt)} onClick={()=>choose(null)}>← 一覧</button>}<button type="button" onClick={()=>void refresh()}>更新</button><span role="status">{message}</span></div>
 <section className={styles.messages} aria-label={selected?'投稿と返信':'最新の投稿'}>{selected?<>{post&&<article><h2>{post.title}</h2><small>{post.author_name} · {format(post.created_at)}</small><p>{post.body}</p></article>}{replies.map(reply=><article key={reply.id}><small>{reply.author_name} · {format(reply.created_at)}</small><p>{reply.body}</p></article>)}</>:posts.length?posts.map(p=><article key={p.id}><button type="button" className={styles.thread} disabled={busy||Boolean(receipt)} onClick={()=>choose(p.id)}><strong>{p.title}</strong><small>{p.author_name} · {format(p.created_at)}</small><p>{p.body.slice(0,220)}</p><span>開いて返信する →</span></button></article>):<p className={styles.empty}>表示できる投稿はまだありません。</p>}</section>
 {authorized?<form className={styles.compose} onSubmit={e=>{e.preventDefault();void send();}}><p>{selected?'この投稿へ返信':'新しい話題を投稿'} · 掲示板に公開されます</p>{!selected&&<input aria-label="投稿タイトル" required maxLength={100} placeholder="タイトル" value={title} disabled={busy||Boolean(receipt)} onChange={e=>setTitle(e.target.value)}/>}<textarea aria-label="投稿本文" required maxLength={1000} placeholder="メッセージを入力…" value={body} disabled={busy||Boolean(receipt)} onChange={e=>setBody(e.target.value)}/><button type="submit" disabled={busy||(!receipt&&(!body.trim()||!selected&&!title.trim()))}>{busy?'送信中…':receipt?'送信結果を再確認':'投稿する'}</button></form>:<p className={styles.login}><a href="/login" target="_blank" rel="noopener noreferrer">ログインして参加する</a><small>ログイン後は「更新」を押してください。</small></p>}
 </main>;
}

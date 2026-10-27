'use client';
import {useState} from 'react';
import styles from './hand-history.module.css';
/** 「掲示板で相談する」: freeze the hand (viewer-safe) and post a thread linking to its replay. */
export function ShareToBoard({handId,defaultTitle}:{handId:string;defaultTitle:string}){
 const [open,setOpen]=useState(false),[title,setTitle]=useState(defaultTitle),[comment,setComment]=useState(''),[state,setState]=useState<{busy?:boolean;error?:string;postId?:string}>({});
 const submit=async()=>{setState({busy:true});
  try{
   const s=await fetch('/api/poker/hand-share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hand:handId})});const sb=await s.json().catch(()=>({}));if(!s.ok)throw Error(sb.error??'このハンドは共有できません。');
   const link=`${window.location.origin}/poker-hands/${sb.shareId}`,id=crypto.randomUUID();
   // The link goes last so nothing is glued to the URL.
   const body=`${comment.trim()||'このハンド、どう打つのがよかったと思いますか？'}\n\nハンドの再生とGTO振り返り：\n${link}`;
   const p=await fetch('/api/poker/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'post',id,title:title.trim(),body})});const pb=await p.json().catch(()=>({}));if(!p.ok)throw Error(pb.error??'投稿できませんでした。');
   setState({postId:pb.id??id});
  }catch(e){setState({error:e instanceof Error?e.message:'投稿できませんでした。'});}};
 if(state.postId)return <div className={styles.result} role="status"><p>掲示板に投稿しました。</p><p><a href={`/board/${state.postId}`}>投稿を見る</a></p></div>;
 return <div className={styles.result}>{!open?<button type="button" onClick={()=>setOpen(true)}>掲示板で相談する</button>:<div className={styles.share}>
  <p className={styles.street}>掲示板で相談する</p>
  <label>タイトル<input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></label>
  <label>ひとこと<textarea value={comment} maxLength={800} rows={3} onChange={e=>setComment(e.target.value)} placeholder="例：AAでこれ降りたけどどう？"/></label>
  <p>あなたの手札と、ショーダウンで公開された手札だけが共有されます。ほかのプレイヤーの名前は出ません。</p>
  <div className={styles.controls}><button type="button" disabled={state.busy} onClick={()=>setOpen(false)}>やめる</button><button type="button" disabled={state.busy||!title.trim()} onClick={()=>void submit()}>{state.busy?'投稿中…':'投稿する'}</button></div>
  {state.error&&<p role="alert">{state.error}</p>}
 </div>}</div>;
}

'use client';
// 自分のアイコン（マイページで設定した画像）をポーカーの画面の右上に出す（オーナー 2026/11/03：アイコンが反映されてない）。
// 読み込めないとき（ログイン前・通信失敗・テスト環境）は今までの人の形のまま。
import {useEffect,useState} from 'react';
import {PlayerAvatar} from './player-avatar';
import {LobbyIcon} from '@/app/poker-lobby/lobby-icon';
export function MyAvatar({name,className}:{name?:string;className?:string}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let live=true;void import('@/lib/supabase/client').then(async m=>{const db=m.createClient();const {data:{session}}=await db.auth.getSession();const id=session?.user.id;if(!id)return;
  const {data}=await db.from('profiles').select('avatar_url').eq('user_id',id).maybeSingle();const v=(data as {avatar_url?:unknown}|null)?.avatar_url;if(live&&typeof v==='string'&&/^https:\/\//i.test(v))setUrl(v);}).catch(()=>{});
  return()=>{live=false;};},[]);
 return url?<PlayerAvatar url={url} name={name??'自分'} className={className}/>:<LobbyIcon name="people"/>;
}

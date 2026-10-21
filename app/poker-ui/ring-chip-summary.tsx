import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {parseRingWallet} from '@/lib/poker/ring-wallet';
export async function RingChipSummary(){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return null;
 const {data,error}=await client.rpc('poker_ring_balance');if(error)return <p>リングchip残高は現在確認できません。<Link href="/mypage/chips">残高画面へ</Link></p>;
 try{const wallet=parseRingWallet(data);return <Link href="/mypage/chips" className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,padding:16,margin:'12px 0',textDecoration:'none',background:'#142d43',color:'#f6e9c8'}}><span>SUMMIT CHIP <strong style={{fontSize:22,marginLeft:12}}>{wallet.total.toLocaleString()} chip</strong></span><span>使用可能 {wallet.available.toLocaleString()} ／ 卓へ持込中 {wallet.inPlay.toLocaleString()}　残高・履歴 →</span></Link>;}catch{return <p>残高を取得できませんでした。再読み込みしてください。</p>;}
}

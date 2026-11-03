import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {HandReplay} from '@/app/poker-ui/hand-replay';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import {NOINDEX} from '@/lib/seo';
export const metadata=NOINDEX;
export const dynamic='force-dynamic';
/** A hand shared to the board: the poster's cards and showdown cards only, other players anonymised. Members only. */
export default async function Page({params}:{params:{shareId:string}}){
 if(!/^[0-9a-f-]{36}$/i.test(params.shareId))notFound();
 const client=await createClient(),{data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login?next='+encodeURIComponent('/poker-hands/'+params.shareId));
 const {data,error}=await client.rpc('poker_hand_share_view',{p_share:params.shareId});
 if(error||!data||!Array.isArray((data as HandHistoryView).players))notFound();
 const hand=data as HandHistoryView&{mine?:boolean};
 return <PokerWorkspace kind="account" panes={[{id:'replay',label:'共有されたハンド',eyebrow:'SHARED HAND',description:'投稿者の手札と、ショーダウンで公開された手札だけが表示されます。ほかのプレイヤーの名前は表示しません。',
  content:<><HandReplay hand={hand} shared/><p><a href="/board">掲示板に戻る</a></p></>}]}/>;
}

import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import OnlineTable from './table';
export const metadata={title:'オンライン対戦 接続確認 | Poker Summit',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function OnlineRoomPage({params}:{params:{roomId:string}}){
 if(!/^[a-f0-9-]{36}$/i.test(params.roomId))notFound();
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 return <OnlineTable roomId={params.roomId} enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)} eventsOrigin={process.env.POKER_ROOM_EVENTS_ORIGIN}/>;
}

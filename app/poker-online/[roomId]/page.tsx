import {GameCommunity} from '@/app/poker-ui/game-community';
import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import OnlineTable from './table';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import GameNavigation from '../../poker-demo/game-navigation';
import styles from '../../poker-demo/poker-table.module.css';
export const metadata={title:'オンラインポーカー | Poker Summit',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function OnlineRoomPage({params}:{params:{roomId:string}}){
 if(!/^[a-f0-9-]{36}$/i.test(params.roomId))notFound();
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 return <div className={styles.gamePage}><GameNavigation header={<PortalHeader userEmail={user.email}/>} footer={<PortalFooter/>}/><GameCommunity><main className={styles.gameMain}><OnlineTable roomId={params.roomId} enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)} eventsOrigin={process.env.POKER_ROOM_EVENTS_ORIGIN}/></main></GameCommunity></div>;
}

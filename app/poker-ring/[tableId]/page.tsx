import {pokerAccess} from '@/lib/poker/access';
import onlineLayout from '@/app/poker-online/[roomId]/table.module.css';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import GameNavigation from '@/app/poker-demo/game-navigation';
import {GameCommunity} from '@/app/poker-ui/game-community';
import gameStyles from '@/app/poker-demo/poker-table.module.css';
import {redirect,notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import RingAdmissionPanel from '@/app/poker-ui/ring-admission-panel';
export const dynamic='force-dynamic';
export const metadata={title:'リング卓 | Poker Summit',robots:{index:false,follow:false}};
export default async function RingPage({params,searchParams}:{params:{tableId:string};searchParams?:{view?:string;buyin?:string}}){if(!/^[a-f0-9-]{36}$/i.test(params.tableId))notFound();const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login?next='+encodeURIComponent('/poker-ring/'+params.tableId+(searchParams?.view==='table'?'?view=table'+(searchParams?.buyin?'&buyin='+encodeURIComponent(searchParams.buyin):''):'')));if(pokerAccess(user)==='verify')redirect('/mypage?poker=verify');if(searchParams?.view==='table')return <div className={`${gameStyles.gamePage} ${onlineLayout.viewport}`}><GameNavigation header={<PortalHeader userEmail={user.email}/>} footer={<PortalFooter/>}/><GameCommunity><main className={gameStyles.gameMain}><RingAdmissionPanel enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)} tableId={params.tableId.toLowerCase()} layout="table" productionFlow initialBuyIn={searchParams?.buyin??''}/></main></GameCommunity></div>;return <PokerWorkspace kind="lobby" panes={[{id:'ring',label:'リング卓',eyebrow:'RING TABLE',description:'持ち込んだchipと着席状況を確認できます。',content:<RingAdmissionPanel enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)} tableId={params.tableId.toLowerCase()}/>} ]}/>;}

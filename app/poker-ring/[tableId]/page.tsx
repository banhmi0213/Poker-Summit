import {redirect,notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {PokerWorkspace} from '@/app/poker-ui/workspace';
import RingAdmissionPanel from '@/app/poker-ui/ring-admission-panel';
export const dynamic='force-dynamic';
export const metadata={title:'リング卓 | Poker Summit',robots:{index:false,follow:false}};
export default async function RingPage({params}:{params:{tableId:string}}){if(!/^[a-f0-9-]{36}$/i.test(params.tableId))notFound();const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login?next='+encodeURIComponent('/poker-ring/'+params.tableId));return <PokerWorkspace kind="lobby" panes={[{id:'ring',label:'リング卓',eyebrow:'RING TABLE',description:'持ち込んだchipと着席状況を確認できます。',content:<RingAdmissionPanel enabled={Boolean(process.env.POKER_ROOM_SERVICE_ORIGIN)} tableId={params.tableId.toLowerCase()}/>} ]}/>;}

import {NextResponse} from 'next/server';
import {loadRecentOwnHands} from '@/lib/poker/hand-histories';

// The member's latest ring hands (own cards only, as the hand history RPC filters them) for 「GTOから外れた率」 (2026/10/29).
export const dynamic='force-dynamic';
// ?kinds=ring,tournament (GTO records, 2026/11/1); ring only by default.
export async function GET(req:Request){
 const asked=(new URL(req.url).searchParams.get('kinds')??'ring').split(','),kinds=(['ring','tournament'] as const).filter(k=>asked.includes(k));
 const hands=await loadRecentOwnHands(100,kinds.length?kinds:['ring']);
 if(!hands)return NextResponse.json({error:'ログインしてください。'},{status:401});
 return NextResponse.json({hands},{headers:{'Cache-Control':'no-store'}});
}

import {NextResponse} from 'next/server';
import {loadRecentOwnRingHands} from '@/lib/poker/hand-histories';

// The member's latest ring hands (own cards only, as the hand history RPC filters them) for 「GTOから外れた率」 (2026/10/29).
export const dynamic='force-dynamic';
export async function GET(){
 const hands=await loadRecentOwnRingHands(100);
 if(!hands)return NextResponse.json({error:'ログインしてください。'},{status:401});
 return NextResponse.json({hands},{headers:{'Cache-Control':'no-store'}});
}

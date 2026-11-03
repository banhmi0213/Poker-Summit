import {NextResponse} from 'next/server';
import {getGtoTier} from '@/lib/billing/plan';
import {gtoAccess} from '@/lib/poker/gto-access';

// Paid preflop charts (owner 2026/11/1): 8/9-max cash charts for スタンダード, 8/9-max tournament depths for プロ.
// Kept out of public/ (data/poker-gto/paid) and served only after the plan check. Hidden from everyone while paid
// features are not shown (paidFeaturesVisible()).
export const dynamic='force-dynamic';
const CHARTS:Record<string,()=>Promise<{default:unknown}>>={
 'preflop-8max':()=>import('@/data/poker-gto/paid/preflop-8max.json'),
 'preflop-8max-10bb':()=>import('@/data/poker-gto/paid/preflop-8max-10bb.json'),
 'preflop-8max-20bb':()=>import('@/data/poker-gto/paid/preflop-8max-20bb.json'),
 'preflop-8max-40bb':()=>import('@/data/poker-gto/paid/preflop-8max-40bb.json'),
 'preflop-8max-60bb':()=>import('@/data/poker-gto/paid/preflop-8max-60bb.json'),
 'preflop-8max-ev':()=>import('@/data/poker-gto/paid/preflop-8max-ev.json'),
 'preflop-8max-rake1000-10':()=>import('@/data/poker-gto/paid/preflop-8max-rake1000-10.json'),
 'preflop-8max-rake500-5':()=>import('@/data/poker-gto/paid/preflop-8max-rake500-5.json'),
 'preflop-9max':()=>import('@/data/poker-gto/paid/preflop-9max.json'),
 'preflop-9max-10bb':()=>import('@/data/poker-gto/paid/preflop-9max-10bb.json'),
 'preflop-9max-20bb':()=>import('@/data/poker-gto/paid/preflop-9max-20bb.json'),
 'preflop-9max-40bb':()=>import('@/data/poker-gto/paid/preflop-9max-40bb.json'),
 'preflop-9max-60bb':()=>import('@/data/poker-gto/paid/preflop-9max-60bb.json'),
 'preflop-9max-ev':()=>import('@/data/poker-gto/paid/preflop-9max-ev.json'),
 'preflop-9max-rake1000-10':()=>import('@/data/poker-gto/paid/preflop-9max-rake1000-10.json'),
 'preflop-9max-rake500-5':()=>import('@/data/poker-gto/paid/preflop-9max-rake500-5.json')
};
/** Tournament depths (60/40/20/10BB with ante) are the プロ tournament pack; the rest is スタンダード. */
const needsPro=(name:string)=>/-(60|40|20|10)bb$/.test(name);
export async function GET(_req:Request,{params}:{params:{name:string}}){
 const load=CHARTS[params.name];if(!load)return NextResponse.json({error:'not found'},{status:404});
 const a=gtoAccess(await getGtoTier());
 if(!(needsPro(params.name)?a.pro:a.standard))return NextResponse.json({error:'このプランでは使えません。'},{status:403});
 const mod=await load();
 return NextResponse.json(mod.default,{headers:{'Cache-Control':'private, max-age=3600'}});
}

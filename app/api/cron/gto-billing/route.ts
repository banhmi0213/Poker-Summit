import {NextResponse,type NextRequest} from 'next/server';
import {GTO_BILLING_FLAG} from '@/lib/billing/plans';
import {komojuConfigured} from '@/lib/billing/komoju';
import {chargeEndedTrials,sendProPriceNotices,switchPrices} from '@/lib/billing/service';
export const dynamic='force-dynamic';
export const maxDuration=120;
/** Hourly (Vercel Cron), GTO plans: trials that ended become paid KOMOJU subscriptions; プロ subscriptions move to the new price
 * shortly before their first charge on/after 2027-03-01; the 2027-02-01 / 02-22 price notices go out. Auth: Bearer CRON_SECRET. */
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});
 if(!GTO_BILLING_FLAG||!komojuConfigured())return NextResponse.json({ok:true,skipped:'billing_off'});
 const out:Record<string,unknown>={ok:true};
 try{out.trials=await chargeEndedTrials();}catch{out.ok=false;out.trials='error';}
 try{out.prices=await switchPrices();}catch{out.ok=false;out.prices='error';}
 try{out.notices=await sendProPriceNotices();}catch{out.ok=false;out.notices='error';}
 return NextResponse.json(out,{status:out.ok?200:503});
}

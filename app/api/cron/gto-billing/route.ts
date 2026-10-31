import {NextResponse,type NextRequest} from 'next/server';
import {GTO_BILLING_FLAG} from '@/lib/billing/plans';
import {komojuConfigured} from '@/lib/billing/komoju';
import {chargeEndedTrials} from '@/lib/billing/service';
export const dynamic='force-dynamic';
export const maxDuration=120;
/** Daily (Vercel Cron): GTO trials that have ended become paid KOMOJU subscriptions. Auth: Bearer CRON_SECRET. */
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});
 if(!GTO_BILLING_FLAG||!komojuConfigured())return NextResponse.json({ok:true,skipped:'billing_off'});
 try{return NextResponse.json({ok:true,...await chargeEndedTrials()});}catch{return NextResponse.json({ok:false},{status:503});}
}

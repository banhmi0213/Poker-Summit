import {NextResponse,type NextRequest} from 'next/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {verifyKomojuSignature} from '@/lib/billing/webhook-signature';
import {syncCustomer,syncSubscription} from '@/lib/billing/service';
export const dynamic='force-dynamic';
/** KOMOJU webhook (GTO plans). Verified with KOMOJU_WEBHOOK_SECRET; each delivery (X-Komoju-ID) is handled once.
 * We do not trust amounts or states in the body: we only take the subscription / customer id and re-read it from KOMOJU. */
export async function POST(req:NextRequest){
 const raw=await req.text();
 if(raw.length>200000||!verifyKomojuSignature(raw,req.headers.get('x-komoju-signature'),process.env.KOMOJU_WEBHOOK_SECRET))return NextResponse.json({ok:false},{status:400});
 const event=(req.headers.get('x-komoju-event')??'').slice(0,100),deliveryId=(req.headers.get('x-komoju-id')??'').slice(0,200);
 if(event==='ping')return NextResponse.json({ok:true});
 let body:{type?:string;data?:Record<string,unknown>}|null=null;try{body=JSON.parse(raw);}catch{return NextResponse.json({ok:false},{status:400});}
 const db=createServiceRoleClient();
 if(deliveryId){
  const {error}=await db.from('gto_billing_events').insert({id:deliveryId,event:event||String(body?.type??'unknown').slice(0,100)});
  if(error){
   if(String((error as {code?:string}).code)==='23505'){const {data}=await db.from('gto_billing_events').select('processed_at').eq('id',deliveryId).maybeSingle();if((data as {processed_at:string|null}|null)?.processed_at)return NextResponse.json({ok:true,duplicate:true});}
   else return NextResponse.json({ok:false},{status:503});
  }
 }
 const name=event||String(body?.type??''),data=body?.data??{};
 const str=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=100?v:null;
 try{
  let note='ignored';
  if(name.startsWith('subscription.')){const id=str(data.id);if(id){await syncSubscription(id);note='subscription';}}
  else if(name.startsWith('payment.')){
   const sub=str((data as {subscription?:unknown}).subscription)??str((data.metadata as Record<string,unknown>|undefined)?.subscription);
   const customer=str(data.customer);
   if(sub){await syncSubscription(sub);note='payment:subscription';}else if(customer){await syncCustomer(customer);note='payment:customer';}
  }
  if(deliveryId)await db.from('gto_billing_events').update({processed_at:new Date().toISOString(),note}).eq('id',deliveryId);
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({ok:false},{status:503});} // KOMOJU retries later
}

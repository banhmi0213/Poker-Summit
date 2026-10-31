import 'server-only';
/** Minimal KOMOJU API client for GTO subscriptions (server only; the secret key never reaches the browser).
 * Card details are entered on KOMOJU's own hosted page (Sessions API, mode "customer"), so they never touch our server.
 * Endpoints (KOMOJU API v1): POST /sessions, GET /sessions/:id, POST /subscriptions, GET /subscriptions/:id,
 * DELETE /subscriptions/:id. Authentication: HTTP Basic with the secret key as user name and an empty password. */
const BASE='https://komoju.com/api/v1';
export class KomojuError extends Error{constructor(public status:number,public code:string){super(`KOMOJU ${status} ${code}`);}}
function key(){const k=process.env.KOMOJU_SECRET_KEY;if(!k)throw new KomojuError(0,'not_configured');return k;}
export function komojuConfigured(){return Boolean(process.env.KOMOJU_SECRET_KEY&&process.env.KOMOJU_WEBHOOK_SECRET);}
async function call<T>(method:'GET'|'POST'|'DELETE',path:string,body?:Record<string,unknown>):Promise<T>{
 const res=await fetch(BASE+path,{method,headers:{Authorization:'Basic '+Buffer.from(key()+':').toString('base64'),'Content-Type':'application/json',Accept:'application/json'},
  body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});
 const text=await res.text();let data:unknown=null;try{data=text?JSON.parse(text):null;}catch{data=null;}
 // Never pass KOMOJU's error text on: it can echo request data.
 if(!res.ok){const code=(data as {error?:{code?:string}}|null)?.error?.code;throw new KomojuError(res.status,typeof code==='string'?code.slice(0,60):'error');}
 return data as T;
}
export type KomojuSession={id:string;session_url?:string;status?:string;customer_id?:string|null;customer?:string|null};
export type KomojuSubscription={id:string;status:string;amount?:number;currency?:string;period?:string;next_capture_at?:string|null;ended_at?:string|null;customer?:string|null;metadata?:Record<string,string>|null};
/** Hosted page that saves a card as a KOMOJU customer (no charge). KOMOJU appends ?action=complete|cancel to return_url. */
export function createCustomerSession(input:{returnUrl:string;email?:string|null;reference:string}){
 return call<KomojuSession>('POST','/sessions',{mode:'customer',return_url:input.returnUrl,default_locale:'ja',payment_types:['credit_card'],
  ...(input.email?{email:input.email}:{}),metadata:{reference:input.reference}});
}
export const getSession=(id:string)=>call<KomojuSession>('GET','/sessions/'+encodeURIComponent(id));
/** The customer id a completed customer-mode session created (field name differs between API versions). */
export function sessionCustomerId(s:KomojuSession):string|null{const v=s.customer_id??s.customer??null;return typeof v==='string'&&v.length>0&&v.length<=100?v:null;}
/** Starts charging now (KOMOJU takes the first payment immediately) and then every period. */
export function createSubscription(input:{customer:string;amount:number;period:'monthly'|'yearly';metadata:Record<string,string>}){
 return call<KomojuSubscription>('POST','/subscriptions',{customer:input.customer,amount:input.amount,currency:'JPY',period:input.period,metadata:input.metadata});
}
export const getSubscription=(id:string)=>call<KomojuSubscription>('GET','/subscriptions/'+encodeURIComponent(id));
export const deleteSubscription=(id:string)=>call<KomojuSubscription>('DELETE','/subscriptions/'+encodeURIComponent(id));

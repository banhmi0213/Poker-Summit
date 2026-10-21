export type RingWallet={available:number;inPlay:number;total:number;rank:number|null;welcomeGranted:boolean;asOf:string;history:{kind:'welcome'|'reserve'|'refund';availableDelta:number;inPlayDelta:number;createdAt:string}[]};
export function parseRingWallet(value:unknown):RingWallet{
 if(!value||typeof value!=='object')throw Error('Invalid wallet');const v=value as Record<string,unknown>;
 for(const key of ['available','inPlay','total'])if(!Number.isSafeInteger(v[key])||Number(v[key])<0||Number(v[key])>4503599627370495)throw Error('Invalid balance');
 if(Number(v.available)+Number(v.inPlay)!==v.total)throw Error('Balance mismatch');
 if(v.rank!==null&&(!Number.isSafeInteger(v.rank)||Number(v.rank)<1))throw Error('Invalid rank');
 if(typeof v.welcomeGranted!=='boolean'||typeof v.asOf!=='string'||!Number.isFinite(Date.parse(v.asOf))||!Array.isArray(v.history)||v.history.length>20)throw Error('Invalid wallet metadata');
 const history=v.history.map((entry:unknown)=>{if(!entry||typeof entry!=='object')throw Error('Invalid history');const e=entry as Record<string,unknown>;if(!['welcome','reserve','refund'].includes(String(e.kind))||!Number.isSafeInteger(e.availableDelta)||!Number.isSafeInteger(e.inPlayDelta)||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))throw Error('Invalid history');
  const a=Number(e.availableDelta),p=Number(e.inPlayDelta);if(e.kind==='welcome'?(a!==3000||p!==0):(a+p!==0||e.kind==='reserve'&&a>=0||e.kind==='refund'&&a<=0))throw Error('Invalid history amount');
  return {kind:e.kind as 'welcome'|'reserve'|'refund',availableDelta:a,inPlayDelta:p,createdAt:e.createdAt};});
 return {available:Number(v.available),inPlay:Number(v.inPlay),total:Number(v.total),rank:v.rank===null?null:Number(v.rank),welcomeGranted:v.welcomeGranted,asOf:v.asOf,history};
}

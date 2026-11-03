/** Public chart/index files only. Never persist member/API responses. */
const CACHE='poker-summit-gto-public-v1',MAX_BYTES=2_000_000,DEPTH='poker-summit-gto-depth';
const allowed=(url:string)=>/^\/poker-gto\/(preflop(?:-(?:10|20|40|60)bb)?\.json|flops\/index\.json)$/.test(url);
export function preferredGtoDepth(){try{const d=Number(localStorage.getItem(DEPTH));return [10,20,40,60,100].includes(d)?d:100;}catch{return 100;}}
export function rememberGtoDepth(d:number){try{if([10,20,40,60,100].includes(d))localStorage.setItem(DEPTH,String(d));}catch{/* Storage is optional. */}}
export async function readPublicGtoCache(url:string):Promise<unknown|null>{
 if(!allowed(url)||typeof caches==='undefined')return null;
 try{const cache=await caches.open(CACHE),r=await cache.match(url);if(!r)return null;
  const ttl=url.includes('/flops/')?300_000:3_600_000;
  if(Date.now()-Number(r.headers.get('x-gto-saved'))>ttl){await cache.delete(url);return null;}
  return await r.json();
 }catch{return null;}
}
let writes=Promise.resolve();
export function savePublicGtoCache(url:string,data:unknown){
 if(!allowed(url)||typeof caches==='undefined')return;
 writes=writes.then(async()=>{try{
  const text=JSON.stringify(data),size=new TextEncoder().encode(text).byteLength;if(size>620_000)return;
  const cache=await caches.open(CACHE);await cache.delete(url);
  const keys=await cache.keys();let total=size;
  for(const key of keys.reverse()){const r=await cache.match(key);const n=Number(r?.headers.get('x-gto-bytes'));if(!n||total+n>MAX_BYTES)await cache.delete(key);else total+=n;}
  await cache.put(url,new Response(text,{headers:{'content-type':'application/json','x-gto-saved':String(Date.now()),'x-gto-bytes':String(size)}}));
 }catch{/* Quota/private mode must not prevent play. */}});
}
/** Hard bound for speculative requests, including decompressed response bytes. */
export async function fetchGtoJson(url:string,maxBytes?:number):Promise<unknown|null>{
 const r=await fetch(url);if(!r.ok)return null;if(!maxBytes)return r.json();
 const reader=r.body?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();return null;}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
 }finally{reader.releaseLock();}
}

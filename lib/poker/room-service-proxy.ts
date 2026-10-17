/** Same-origin gateway. Only a trusted server configuration selects the upstream. */
export async function forwardPokerRoomRequest(request:Request,roomId:string,serviceOrigin:string|undefined,fetcher:typeof fetch=fetch){
 const fail=(status:number)=>Response.json({ok:false,error:status===503?'temporarily_unavailable':'invalid_request'},{status,headers:{'Cache-Control':'no-store, private'}});
 if(!serviceOrigin)return fail(503);
 let upstream:URL;try{upstream=new URL(serviceOrigin);if(!['http:','https:'].includes(upstream.protocol)||upstream.origin!==serviceOrigin||upstream.username||upstream.password)throw Error();}catch{return fail(503);}
 if(request.method!=='POST'||!(/^[a-f0-9-]{36}$/i.test(roomId))||new URL(request.url).search||request.headers.get('origin')!==new URL(request.url).origin)return fail(400);
 const reader=request.body?.getReader();if(!reader)return fail(400);const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){void reader.cancel().catch(()=>{});return fail(413);}chunks.push(value);}}catch{return fail(400);}finally{reader.releaseLock();}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
 const headers=new Headers();for(const name of ['origin','authorization','x-poker-connection','content-type']){const value=request.headers.get(name);if(value!==null)headers.set(name,value);}
 try{
  const response=await fetcher(`${upstream.origin}/api/poker/rooms/${roomId}`,{method:'POST',headers,body,cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
  return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Vary':'Origin, Authorization, X-Poker-Connection'}});
 }catch{return fail(503);}
}

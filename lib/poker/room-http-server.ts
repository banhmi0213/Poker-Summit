/** Explicit Node HTTP adapter for a single registry process. Construction never listens. */
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
type Handler=(request:Request,roomId:string)=>Promise<Response>;
export function createPokerRoomHTTPServer(handler:Handler,options:{maxInFlight?:number;lobbyHandler?:(request:Request)=>Promise<Response>;managerHandler?:(request:Request)=>Promise<Response>}={}){
 const limit=options.maxInFlight??32;if(!Number.isSafeInteger(limit)||limit<1||limit>1024)throw Error('Invalid HTTP limit');let active=0;
 const server=createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000,keepAliveTimeout:5000},(req,res)=>{void dispatch(req,res);});
 function reject(res:ServerResponse,status:number){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end(JSON.stringify({ok:false,error:status===413?'request_too_large':status===404?'room_not_found':'temporarily_unavailable'}));}
 async function dispatch(req:IncomingMessage,res:ServerResponse){
  if(active>=limit){reject(res,503);return;}active++;
  const controller=new AbortController();const abort=()=>{if(!res.writableEnded)controller.abort();};res.on('close',abort);
  const deadline=setTimeout(()=>{controller.abort();if(!res.writableEnded)reject(res,503);},10000);deadline.unref();
  try{
   const match=/^\/api\/poker\/rooms\/([a-f0-9-]{36})$/i.exec(req.url??'');const lobby=req.url==='/api/poker/lobby'?options.lobbyHandler:req.url==='/api/poker/registration-management'?options.managerHandler:undefined;if(!match&&!lobby){reject(res,404);return;}
   // Reject duplicate security headers rather than accept Node's merging/discarding behavior.
   const seen=new Set<string>();for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(['authorization','origin','x-poker-connection','content-type','content-length'].includes(name)){if(seen.has(name)){reject(res,400);return;}seen.add(name);}}
   const chunks:Buffer[]=[];let bytes=0;
   for await(const chunk of req.iterator({destroyOnReturn:false})){bytes+=Buffer.byteLength(chunk);if(bytes>4096){reject(res,413);return;}chunks.push(Buffer.from(chunk));}
   if(controller.signal.aborted)return;
   const headers=new Headers();for(const [name,value]of Object.entries(req.headers)){if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);}
   const request=new Request('http://room.internal'+req.url,{method:req.method,headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method??'GET')?{body:Buffer.concat(chunks)}:{})});
   const response=lobby?await lobby(request):await handler(request,match![1]);if(res.writableEnded||res.destroyed)return;
   const responseBytes=Buffer.from(await response.arrayBuffer());if(res.writableEnded||res.destroyed)return;res.writeHead(response.status,Object.fromEntries(response.headers));res.end(responseBytes);
  }catch{if(!res.writableEnded&&!res.destroyed)reject(res,503);}
  finally{clearTimeout(deadline);res.off('close',abort);active--;}
 }
 return server;
}

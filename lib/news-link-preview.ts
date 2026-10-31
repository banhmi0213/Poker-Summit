import "server-only";
import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

// Only authenticated editors fetch link metadata. Pin the checked IPv4 address
// for each request and redirect so a DNS change cannot target internal services.
export function isPublicIPv4(ip:string){
 const p=ip.split('.').map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 const [a,b,c]=p;
 return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export function publicHttpsUrl(value:string){const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||(u.port&&u.port!=="443")||u.href.length>2048||u.hostname.includes(':')||u.hostname.endsWith('.local')||u.hostname==='localhost')throw Error("公開HTTPSページを指定してください。");if(isIP(u.hostname)&&!isPublicIPv4(u.hostname))throw Error("内部アドレスは使用できません。");return u;}
async function addressFor(u:URL,deadline=Date.now()+8000){if(isIP(u.hostname))return u.hostname;let timer:ReturnType<typeof setTimeout>|undefined;try{const ips=await Promise.race([resolve4(u.hostname),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("画像の確認がタイムアウトしました。")),Math.max(1,Math.min(4000,deadline-Date.now())));})]);if(!ips.length||ips.some(x=>!isPublicIPv4(x)))throw Error("内部アドレスは使用できません。");return ips[0];}finally{clearTimeout(timer);}}
export async function readPreviewPage(value:string,redirects=0,deadline=Date.now()+8000):Promise<{html:string;url:string}>{
 const u=publicHttpsUrl(value),ip=await addressFor(u,deadline);if(Date.now()>=deadline)throw Error("画像の確認がタイムアウトしました。");
 const response=await new Promise<{status:number;location?:string;type:string;bytes:Buffer}>((resolve,reject)=>{
  const req=request(u,{method:"GET",agent:false,family:4,lookup:(_host,_options,cb)=>cb(null,ip,4),headers:{"User-Agent":"PokerSummit-LinkPreview/1.0","Accept":"text/html,application/xhtml+xml","Accept-Encoding":"identity"}},res=>{
   const chunks:Buffer[]=[];let size=0;
   if(res.statusCode&&[301,302,303,307,308].includes(res.statusCode)){res.destroy();resolve({status:res.statusCode,location:res.headers.location,type:"",bytes:Buffer.alloc(0)});return;}
   const type=String(res.headers['content-type']||'');if(!/^(text\/html|application\/xhtml\+xml)\b/i.test(type)){res.destroy();reject(Error("紹介画像を読み取れるページではありません。"));return;}
   res.on('data',(chunk:Buffer)=>{const part=chunk.subarray(0,512*1024-size);size+=part.length;chunks.push(part);const bytes=Buffer.concat(chunks);if(size>=512*1024||/<\/head\s*>/i.test(bytes.toString('utf8'))){resolve({status:res.statusCode||0,type,bytes});res.destroy();}});res.on('end',()=>resolve({status:res.statusCode||0,type,bytes:Buffer.concat(chunks)}));res.on('error',reject);
  });
  const timer=setTimeout(()=>req.destroy(Error("画像の確認がタイムアウトしました。")),Math.max(1,Math.min(6000,deadline-Date.now())));req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });
 if(response.location){if(redirects>=3)throw Error("転送回数が多すぎます。");return readPreviewPage(new URL(response.location,u).href,redirects+1,deadline);}
 if(response.status<200||response.status>=300)throw Error("リンク先から紹介画像を取得できませんでした。");
 return {html:response.bytes.toString('utf8'),url:u.href};
}
function entities(s:string){return s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(_,key:string)=>{if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'} as Record<string,string>)[key.toLowerCase()]||'';});}
export function extractPreviewImage(html:string,pageUrl:string){
 const values=new Map<string,string>();
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs=new Map<string,string>();for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs.set(m[1].toLowerCase(),entities(m[2]??m[3]??m[4]??''));const key=(attrs.get('property')||attrs.get('name')||'').toLowerCase();const value=attrs.get('content');if(key&&value&&!values.has(key))values.set(key,value);}
 for(const key of ['og:image:secure_url','og:image','twitter:image','twitter:image:src']){const value=values.get(key);if(value){try{return publicHttpsUrl(new URL(value,pageUrl).href).href;}catch{/* Try the next safe metadata image. */}}}return '';
}
export async function validatePreviewImageUrl(value:string){const u=publicHttpsUrl(value);await addressFor(u);return u.href;}
export async function getNewsLinkPreview(sourceUrl:string){
 try{const deadline=Date.now()+8000;const page=await readPreviewPage(sourceUrl,0,deadline);const image=extractPreviewImage(page.html,page.url);if(!image)return {imageUrl:'',sourceUrl:page.url,error:'紹介画像が設定されていません。手動画像も登録できます。'};await addressFor(publicHttpsUrl(image),deadline);return {imageUrl:image,sourceUrl:page.url,error:''};}catch{return {imageUrl:'',sourceUrl,error:'リンク先の紹介画像を取得できませんでした。再取得または手動登録をお試しください。'};}
}


/** Server-only validated configuration. Never serialize or log the returned secrets. */
import type {KeyRing} from './room-persistence';
export type RoomServerConfig={url:string;secretKey:string;publicKey:string;keys:KeyRing;origins:string[];host:string;port:number;maxRooms:number};
export function readRoomServerConfig(env:Readonly<Record<string,string|undefined>>):RoomServerConfig{
 // Every failure has the same safe message: parsing errors can contain secrets.
 try{
  const required=(name:string)=>{const v=env[name];if(typeof v!=='string'||!v||v!==v.trim())throw Error();return v;};
  const url=required('POKER_SUPABASE_URL'),parsed=new URL(url);
  if(parsed.origin!==url||parsed.username||parsed.password||!(parsed.protocol==='https:'||parsed.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)))throw Error();
  const secretKey=required('POKER_SUPABASE_SECRET_KEY'),publicKey=required('POKER_SUPABASE_PUBLIC_KEY');
  const role=(key:string)=>{try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')).role;}catch{return null;}};
  if(!(secretKey.startsWith('sb_secret_')&&secretKey.length>10||role(secretKey)==='service_role')||!(publicKey.startsWith('sb_publishable_')&&publicKey.length>15||role(publicKey)==='anon'))throw Error();
  const raw:unknown=JSON.parse(required('POKER_ROOM_KEYS_JSON')),active=required('POKER_ROOM_ACTIVE_KEY');
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length<1||Object.keys(raw).length>16)throw Error();
  const keys:Record<string,Uint8Array>=Object.create(null);
  for(const [id,value]of Object.entries(raw)){if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||typeof value!=='string')throw Error();const bytes=Buffer.from(value,'base64');if(bytes.length!==32||bytes.toString('base64')!==value)throw Error();keys[id]=bytes;}
  if(!Object.hasOwn(keys,active))throw Error();
  const origins:unknown=JSON.parse(required('POKER_ROOM_ORIGINS'));
  if(!Array.isArray(origins)||origins.length<1||origins.length>32||origins.some(o=>typeof o!=='string'||new URL(o).origin!==o||!(new URL(o).protocol==='https:'||new URL(o).protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(new URL(o).hostname)))||new Set(origins).size!==origins.length)throw Error();
  const integer=(name:string,fallback:number,min:number,max:number)=>{const v=env[name];if(v===undefined)return fallback;if(!/^(0|[1-9][0-9]*)$/.test(v))throw Error();const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error();return n;};
  const host=env.POKER_ROOM_HOST??'127.0.0.1';if(!['127.0.0.1','0.0.0.0','::1','::'].includes(host))throw Error();
  return {url,secretKey,publicKey,keys:{active,keys},origins:[...origins],host,port:integer('PORT',3001,1,65535),maxRooms:integer('POKER_ROOM_MAX_ROOMS',128,1,10000)};
 }catch{throw new Error('Invalid poker server configuration');}
}

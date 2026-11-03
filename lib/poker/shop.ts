/** Summit chip exchange (tickets for ring games). Shapes returned by poker_shop / poker_shop_exchange. */
/** kind 'skin': exchanged once and kept (着せ替え). */
export type ShopItem={code:string;label:string;description:string;price:number;kind:'ticket'|'skin'};
export type ShopHistory={item:string;label:string;quantity:number;total:number;createdAt:string};
export type ShopView={available:number;items:ShopItem[];tickets:Record<string,number>;history:ShopHistory[]};
export type AdminShopItem={code:string;label:string;description:string;price:number|null;active:boolean};

const int=(v:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw Error('Invalid shop number');return Number(v);};
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid shop text');return v;};
const code=(v:unknown)=>{if(typeof v!=='string'||!/^[a-z_]{1,32}$/.test(v))throw Error('Invalid item code');return v;};

export function parseShop(value:unknown):ShopView{
 if(!value||typeof value!=='object')throw Error('Invalid shop');const v=value as Record<string,unknown>;
 if(!Array.isArray(v.items)||!v.tickets||typeof v.tickets!=='object'||Array.isArray(v.tickets)||(v.history!==undefined&&!Array.isArray(v.history)))throw Error('Invalid shop');
 const items=v.items.map(entry=>{const e=(entry??{}) as Record<string,unknown>;return {code:code(e.code),label:text(e.label,40),description:text(e.description??'',200),price:int(e.price,1,1000000),kind:(e.kind==='skin'?'skin':'ticket') as 'ticket'|'skin'};});
 const tickets:Record<string,number>={};for(const [k,n] of Object.entries(v.tickets as Record<string,unknown>))tickets[code(k)]=int(n,0,100000);
 const history=((v.history??[]) as unknown[]).slice(0,10).map(entry=>{const e=(entry??{}) as Record<string,unknown>;if(typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))throw Error('Invalid shop history');return {item:code(e.item),label:text(e.label,40),quantity:int(e.quantity,1,10),total:int(e.total,1,10000000),createdAt:e.createdAt};});
 return {available:int(v.available,0,4503599627370495),items,tickets,history};
}

export function parseAdminShop(value:unknown):AdminShopItem[]{
 if(!Array.isArray(value))throw Error('Invalid admin shop');
 return value.map(entry=>{const e=(entry??{}) as Record<string,unknown>;if(typeof e.active!=='boolean')throw Error('Invalid admin shop');return {code:code(e.code),label:text(e.label,40),description:text(e.description??'',200),price:e.price===null?null:int(e.price,1,1000000),active:e.active};});
}

/** Japanese message for a failed exchange. */
export function shopError(message:string|undefined){
 if(message?.includes('Insufficient chips'))return '使用可能なchipが足りません。';
 if(message?.includes('Item unavailable'))return 'この品は今は交換できません。画面を再読み込みしてください。';
 if(message?.includes('Already owned'))return 'この着せ替えはもう持っています。';
 if(message?.includes('Login required'))return 'ログインしてください。';
 return '交換できませんでした。時間をおいてもう一度お試しください。';
}

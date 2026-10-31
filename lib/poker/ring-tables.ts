import {TABLE_RAKES} from './ring-rake';
/** rake_bps/rake_cap_bb: the table's rake, one of the charted levels (owner 2026/10/31: レーキは卓ごと). */
export type RingSettings={title:string;capacity:2|6;sb:number;bb:number;min_buy_in:number;max_buy_in:number;note:string;published:boolean;sort_order:number;rake_bps:number;rake_cap_bb:number};
export type RingTable=RingSettings&{id:string;revision:number;created_at:string;updated_at:string};
export const ringColumns='id,title,capacity,sb,bb,min_buy_in,max_buy_in,note,published,sort_order,rake_bps,rake_cap_bb,revision,created_at,updated_at';
export function validateRingSettings(value:unknown):RingSettings{
 if(!value||typeof value!=='object')throw Error('卓設定を確認してください。');
 const v=value as Record<string,unknown>;
 const title=typeof v.title==='string'?v.title.trim():'';
 if(!title||title.length>120)throw Error('卓名は1〜120文字で入力してください。');
 if(v.capacity!==2&&v.capacity!==6)throw Error('人数は2人卓または6人卓を選択してください。');
 for(const key of ['sb','bb','min_buy_in','max_buy_in','sort_order'])if(!Number.isSafeInteger(v[key])||Number(v[key])<0||Number(v[key])>1000000000)throw Error('チップ数と表示順は範囲内の整数で入力してください。');
 if(Number(v.sb)<1||Number(v.bb)<=Number(v.sb))throw Error('BBはSBより大きく設定してください。');
 if(Number(v.min_buy_in)<Number(v.bb)||Number(v.max_buy_in)<Number(v.min_buy_in))throw Error('持込チップはBB以上で、最大額を最小額以上にしてください。');
 if(Number(v.sort_order)>999)throw Error('表示順は0〜999で設定してください。');
 if(typeof v.note!=='string'||v.note.length>500||typeof v.published!=='boolean')throw Error('説明文と公開設定を確認してください。');
 const rake=TABLE_RAKES.find(r=>r.bps===(v.rake_bps??TABLE_RAKES[0].bps)&&r.capBb===(v.rake_cap_bb??TABLE_RAKES[0].capBb));if(!rake)throw Error('レーキは低レーキ（5%・上限5BB）か高レーキ（10%・上限10BB）を選んでください。');
 return {rake_bps:rake.bps,rake_cap_bb:rake.capBb,title,capacity:v.capacity,sb:Number(v.sb),bb:Number(v.bb),min_buy_in:Number(v.min_buy_in),max_buy_in:Number(v.max_buy_in),sort_order:Number(v.sort_order),note:v.note.trim(),published:v.published};
}

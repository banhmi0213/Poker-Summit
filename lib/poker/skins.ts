/** Table, card-face and card-back skins (owner 2026/10/27: 卓4・カード表3・裏4, some free, some from the shop).
 * Designs come from Daniel (images under public/images/skins/<id>/); "standard" is the current design and uses the
 * stylesheet as it is. A shop skin carries shopCode: owning one (ticket count > 0 in poker_shop) unlocks it for good. */
export type TableSkin={id:string;name:string;free:boolean;shopCode?:string;thumb?:string;desktop:string;mobile:string;textColor?:string};
export type CardSkin={id:string;name:string;free:boolean;shopCode?:string;thumb?:string;
 face:{background:string;border:string;spade:string;heart:string;diamond:string;club:string;font?:string}};
/** Card backs are chosen separately from the faces. image undefined = the current Summit design. */
export type BackSkin={id:string;name:string;free:boolean;shopCode?:string;thumb?:string;image?:string};
export const TABLE_SKINS:readonly TableSkin[]=[
 {id:'standard',name:'標準',free:true,desktop:'/images/poker-table-desktop.png',mobile:'/images/poker-table-mobile.png'},
];
export const CARD_SKINS:readonly CardSkin[]=[
 {id:'standard',name:'標準',free:true,face:{background:'#fff',border:'#deded9',spade:'#13161b',heart:'#cf1024',diamond:'#cf1024',club:'#13161b'}},
];
export const BACK_SKINS:readonly BackSkin[]=[
 {id:'standard',name:'標準',free:true},
];
export const tableSkin=(id:string|undefined,list=TABLE_SKINS)=>list.find(s=>s.id===id)??list[0];
export const cardSkin=(id:string|undefined,list=CARD_SKINS)=>list.find(s=>s.id===id)??list[0];
export const backSkin=(id:string|undefined,list=BACK_SKINS)=>list.find(s=>s.id===id)??list[0];
/** Free skins, or shop skins the member has exchanged for. */
export function skinUnlocked(skin:{free:boolean;shopCode?:string},owned:Readonly<Record<string,number>>){return skin.free||Boolean(skin.shopCode&&(owned[skin.shopCode]??0)>0);}
/** Attributes and CSS variables for the felt element. The standard skins add nothing, so the stylesheet applies as is. */
export function skinProps(table:TableSkin,card:CardSkin,back:BackSkin=BACK_SKINS[0]):{'data-table-skin'?:string;'data-card-skin'?:string;'data-card-back'?:string;style?:Record<string,string>}{
 const style:Record<string,string>={},out:ReturnType<typeof skinProps>={};
 if(table.id!=='standard'){out['data-table-skin']=table.id;style['--skin-table-desktop']=`url('${table.desktop}')`;style['--skin-table-mobile']=`url('${table.mobile}')`;if(table.textColor)style['--skin-table-text']=table.textColor;}
 if(card.id!=='standard'){out['data-card-skin']=card.id;const f=card.face;Object.assign(style,{'--skin-card-bg':f.background,'--skin-card-border':f.border,'--skin-card-s':f.spade,'--skin-card-h':f.heart,'--skin-card-d':f.diamond,'--skin-card-c':f.club});if(f.font)style['--skin-card-font']=f.font;
}
 if(back.image){out['data-card-back']='image';style['--skin-card-back']=`url('${back.image}')`;}
 if(Object.keys(style).length)out.style=style;
 return out;
}

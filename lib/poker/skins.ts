/** Table, card-face and card-back skins (owner 2026/10/27: 卓4・カード表3・裏4, some free, some from the shop).
 * Designs come from Daniel (images under public/images/skins/<id>/); "standard" is the current design and uses the
 * stylesheet as it is. A shop skin carries shopCode: owning one (ticket count > 0 in poker_shop) unlocks it for good. */
export type TableSkin={id:string;name:string;free:boolean;shopCode?:string;thumb?:string;desktop:string;mobile:string;textColor?:string};
export type CardSkin={id:string;name:string;free:boolean;shopCode?:string;thumb?:string;
 face:{background:string;border:string;spade:string;heart:string;diamond:string;club:string;font?:string};
 /** Finished card images (ロイヤル絵札): by rank then suit; drawn instead of the corners and centre suit. */
 art?:Partial<Record<number,Partial<Record<'s'|'h'|'d'|'c',string>>>>};
/** Card backs are chosen separately from the faces. image undefined = the current Summit design. */
export type BackSkin={id:string;name:string;free:boolean;shopCode?:string;thumb?:string;image?:string};
// Designs by Daniel (2026/10/27). Shop prices: 卓 3,000 chip, 表 4色 1,500 / ロイヤル 2,500, 裏 1,500.
export const TABLE_SKINS:readonly TableSkin[]=[
 {id:'standard',name:'クラシックベージュ',free:true,thumb:'/images/skins/standard/table-thumb.png',desktop:'/images/poker-table-desktop.png',mobile:'/images/poker-table-mobile.png'},
 {id:'forest',name:'フォレスト',free:false,shopCode:'table_forest',thumb:'/images/skins/forest/thumb.png',desktop:'/images/skins/forest/table-desktop.webp',mobile:'/images/skins/forest/table-mobile.webp',textColor:'#F8EBD0'},
 {id:'bordeaux',name:'ボルドー',free:false,shopCode:'table_bordeaux',thumb:'/images/skins/bordeaux/thumb.png',desktop:'/images/skins/bordeaux/table-desktop.webp',mobile:'/images/skins/bordeaux/table-mobile.webp',textColor:'#F8EBD0'},
 {id:'navy',name:'ネイビー',free:false,shopCode:'table_navy',thumb:'/images/skins/navy/thumb.png',desktop:'/images/skins/navy/table-desktop.webp',mobile:'/images/skins/navy/table-mobile.webp',textColor:'#F8EBD0'},
];
const SKIN_FONT="'PokerSkinRoboto', Arial, sans-serif";
const royal=(r:string)=>({s:`/images/skins/face-royal/${r}s.png`,h:`/images/skins/face-royal/${r}h.png`,d:`/images/skins/face-royal/${r}d.png`,c:`/images/skins/face-royal/${r}c.png`});
export const CARD_SKINS:readonly CardSkin[]=[
 {id:'standard',name:'標準ジャンボ',free:true,thumb:'/images/skins/standard/card-thumb.png',face:{background:'#fff',border:'#deded9',spade:'#13161b',heart:'#cf1024',diamond:'#cf1024',club:'#13161b'}},
 {id:'fourcolor',name:'4カラージャンボ',free:false,shopCode:'card_front_fourcolor',thumb:'/images/skins/face-fourcolor/thumb.png',face:{background:'#FFFFFF',border:'#DEDED9',spade:'#13161B',heart:'#C82038',club:'#16814D',diamond:'#1768C4',font:SKIN_FONT}},
 {id:'royal',name:'ロイヤル絵札',free:false,shopCode:'card_front_royal',thumb:'/images/skins/face-royal/thumb.png',face:{background:'#FFFEFA',border:'#B89854',spade:'#13161B',heart:'#CF1024',club:'#13161B',diamond:'#CF1024',font:SKIN_FONT},
  art:{11:royal('J'),12:royal('Q'),13:royal('K'),14:{s:'/images/skins/face-royal/As.png'}}},
];
export const BACK_SKINS:readonly BackSkin[]=[
 {id:'standard',name:'クラシックネイビー',free:true,thumb:'/images/skins/back-navy/thumb.png'},
 {id:'onyx',name:'オニキスゴールド',free:false,shopCode:'card_back_onyx',thumb:'/images/skins/back-onyx/thumb.png',image:'/images/skins/back-onyx/back.svg'},
 {id:'ivory',name:'アイボリーゴールド',free:false,shopCode:'card_back_ivory',thumb:'/images/skins/back-ivory/thumb.png',image:'/images/skins/back-ivory/back.svg'},
 {id:'bordeaux',name:'ボルドーゴールド',free:false,shopCode:'card_back_bordeaux',thumb:'/images/skins/back-bordeaux/thumb.png',image:'/images/skins/back-bordeaux/back.svg'},
];
/** Every shop code with its price (chips), for the shop catalogue. */
export const SKIN_SHOP_ITEMS:readonly {code:string;label:string;price:number}[]=[
 ...TABLE_SKINS.filter(s=>s.shopCode).map(s=>({code:s.shopCode!,label:`卓の着せ替え：${s.name}`,price:3000})),
 {code:'card_front_fourcolor',label:'カードの表：4カラージャンボ',price:1500},
 {code:'card_front_royal',label:'カードの表：ロイヤル絵札',price:2500},
 ...BACK_SKINS.filter(s=>s.shopCode).map(s=>({code:s.shopCode!,label:`カードの裏：${s.name}`,price:1500})),
];
/** The finished image for a card under a face skin, if it has one. */
export const cardArt=(skin:CardSkin,card:{rank:number;suit:'s'|'h'|'d'|'c'})=>skin.art?.[card.rank]?.[card.suit];
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

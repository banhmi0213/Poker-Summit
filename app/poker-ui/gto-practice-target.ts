/** Only the six-seat situations supported by the existing drill worker. A requested
 * target must never silently fall back to unrelated random questions. */
export function preflopPracticeSpot(value:string|undefined|null):string|null{
 if(!value)return null;
 const m=/^pre:(open|vsOpen|vs3bet):(UTG|HJ|CO|BTN|SB|BB)(?::(UTG|HJ|CO|BTN|SB|BB))?$/.exec(value);
 if(!m)return null;
 const [,kind,seat,opponent]=m;
 if(kind==='open')return !opponent&&seat!=='BB'?value:null;
 if(!opponent||opponent===seat)return null;
 if(kind==='vsOpen'&&seat==='UTG'||kind==='vs3bet'&&seat==='BB')return null;
 return value;
}
export function weakPracticeLink(spot:string){
 const target=preflopPracticeSpot(spot);
 if(target)return {href:`/mypage/poker?pane=trainer&practice=${encodeURIComponent(target)}`,label:'この場面を練習',note:'同じ席・相手の6人卓100BBで練習します。'};
 if(spot.startsWith('flop:'))return {href:'/mypage/poker?pane=trainer&practice=flop',label:'フロップから練習',note:'席・相手・ボードは毎回変わります。'};
 return {href:'/mypage/poker?pane=trainer',label:'対戦で練習',note:'この場面だけの出題には未対応です。1ハンド通して練習できます。'};
}

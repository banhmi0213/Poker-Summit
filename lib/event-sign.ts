export function eventSignLabel(category: string | null | undefined): "TOURNAMENT" | "EVENT" {
 return /大会|トーナメント|tournament/i.test(category || "") ? "TOURNAMENT" : "EVENT";
}
export const eventTitleWidth = (text:string) => [...text].reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?0.55:1),0);
export function eventTitleLines(title:string):string[] {
 const name=title.trim().replace(/\s+/g," ") || "タイトル未設定";
 if(eventTitleWidth(name)<=11)return [name];
 const venueBreak=name.search(/[＠@]/);
 if(venueBreak>0 && eventTitleWidth(name.slice(0,venueBreak))<=14 && eventTitleWidth(name.slice(venueBreak))>=2)return [name.slice(0,venueBreak).trim(),name.slice(venueBreak).trim()];
 const chars=Array.from(name);
 const preferred=[...name.matchAll(/\s+|(?=＠|@|トーナメント|交流会|体験会|初心者|ポーカー)/g)].map(m=>m.index!).filter(i=>i>0&&i<name.length);
 const positions:number[]=[];let offset=0;
 for(let i=0;i<chars.length-1;i++){offset+=chars[i].length;if(!/[A-Za-z0-9]/.test(chars[i])||!/[A-Za-z0-9]/.test(chars[i+1]))positions.push(offset);}
 const usable=(preferred.length?preferred:positions).filter(i=>eventTitleWidth(name.slice(0,i))>=3&&eventTitleWidth(name.slice(i))>=3);
 if(!usable.length)return [name];
 const score=(i:number)=>Math.max(eventTitleWidth(name.slice(0,i)),eventTitleWidth(name.slice(i)));
 const split=usable.reduce((best,i)=>score(i)<score(best)?i:best,usable[0]);
 return [name.slice(0,split).trim(),name.slice(split).trim()];
}
export function eventSignDate(value:string | null | undefined) {
 if(!value)return "日時未定";
 const d=new Date(value);if(Number.isNaN(d.getTime()))return "日時未定";
 return `${d.toLocaleDateString("ja-JP",{month:"2-digit",day:"2-digit",timeZone:"Asia/Tokyo"})} ${d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"})}`;
}

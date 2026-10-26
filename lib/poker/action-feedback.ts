/** Presentation from public betting totals only; no cards or credentials retained. */
export type ActionKind='fold'|'check'|'call'|'bet'|'raise'|'allin';
export type ActionPlayer={id:string;committed:number;totalCommitted:number;folded:boolean;allIn:boolean};
export const actionWords:Record<ActionKind,string>={fold:'フォールド',check:'チェック',call:'コール',bet:'ベット',raise:'レイズ',allin:'オールイン'};
export function publicAction(before:readonly ActionPlayer[]|undefined,after:readonly ActionPlayer[]|undefined,actor:string|null){
 const a=before?.find(p=>p.id===actor),b=after?.find(p=>p.id===actor);if(!a||!b||a.folded||a.allIn)return null;
 const amount=Math.max(0,b.totalCommitted-a.totalCommitted),priorBet=Math.max(0,...before!.map(p=>p.committed));
 const kind:ActionKind=b.folded?'fold':b.allIn?'allin':amount===0?'check':a.committed+amount>priorBet?(priorBet>0?'raise':'bet'):'call';
 return {kind,amount,actor:actor!,label:actionWords[kind]};
}
/** Short, distinct original effects: chip clacks, felt tap, card swipe, all-in accent. */
export function playActionEffect(c:AudioContext,kind:ActionKind){
 const now=c.currentTime;
 const note=(f:number,t:number,d:number,v:number)=>{const o=c.createOscillator(),g=c.createGain(),at=now+t;o.type='triangle';o.frequency.setValueAtTime(f,at);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(v,at+.002);g.gain.exponentialRampToValueAtTime(.0001,at+d);o.connect(g);g.connect(c.destination);o.start(at);o.stop(at+d+.01);o.onended=()=>{o.disconnect();g.disconnect();};};
 if(kind==='check'){note(180,0,.045,.12);return;}
 if(kind==='fold'){
  const buf=c.createBuffer(1,Math.ceil(c.sampleRate*.12),c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf;f.type='bandpass';f.frequency.value=1100;g.gain.setValueAtTime(.09,now);s.connect(f);f.connect(g);g.connect(c.destination);s.start(now);s.stop(now+.12);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};return;
 }
 const count=kind==='allin'?7:kind==='raise'?5:kind==='bet'?4:2;
 for(let i=0;i<count;i++){note(1350+(i%3)*370,i*.045,.045,.065);note(340+(i%2)*80,i*.045,.025,.075);}
 if(kind==='allin'){note(392,.35,.15,.09);note(587.33,.43,.2,.09);}
}

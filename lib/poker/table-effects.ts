/** Table sound effects chosen by the owner (2026/10/26): deal F, fold E, check D, call/bet/raise E, pot win = shove + fanfare.
 * Synthesized in the browser (no audio files, no network). Every function only schedules nodes on the given context. */
export type EffectKind='deal'|'fold'|'check'|'call'|'bet'|'raise'|'allin'|'win';

const noiseByContext=new WeakMap<BaseAudioContext,AudioBuffer>(),masterByContext=new WeakMap<BaseAudioContext,AudioNode>();
const rnd=(a:number,b:number)=>a+Math.random()*(b-a);
function noise(c:BaseAudioContext){
 let b=noiseByContext.get(c);
 if(!b){b=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;noiseByContext.set(c,b);}
 return b;
}
function out(c:BaseAudioContext,pan=0):AudioNode{
 let m=masterByContext.get(c);
 if(!m){const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(c.destination);m=comp;masterByContext.set(c,m);}
 if(typeof c.createStereoPanner!=='function')return m;
 const p=c.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));p.connect(m);return p;
}
function envelope(g:GainNode,t:number,peak:number,att:number,dec:number){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+att+dec);}
type Hiss={dur?:number;f0?:number;f1?:number;q?:number;vol?:number;att?:number;pan?:number;lp?:number};
function hiss(c:BaseAudioContext,t:number,{dur=.1,f0=3000,f1=f0,q=1,vol=.2,att=.006,pan=0,lp=0}:Hiss){
 const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=noise(c);
 f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+att+dur);
 let last:AudioNode=f;if(lp){const l=c.createBiquadFilter();l.type='lowpass';l.frequency.value=lp;f.connect(l);last=l;}
 envelope(g,t,vol,att,dur);s.connect(f);last.connect(g);const o=out(c,pan);g.connect(o);
 s.start(t,Math.random()*1.5);s.stop(t+att+dur+.03);s.onended=()=>{s.disconnect();f.disconnect();last.disconnect();g.disconnect();o.disconnect();};
}
type Thump={f?:number;f1?:number;dur?:number;vol?:number;type?:OscillatorType;pan?:number};
function thump(c:BaseAudioContext,t:number,{f=160,f1=80,dur=.08,vol=.4,type='sine',pan=0}:Thump){
 const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
 envelope(g,t,vol,.002,dur);o.connect(g);const p=out(c,pan);g.connect(p);o.start(t);o.stop(t+dur+.03);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
}
/** Clay chip on chip: broadband click plus a short plastic body knock. */
function chip(c:BaseAudioContext,t:number,{hi=5200,body=1300,vol=.25,pan=0,len=1}={}){
 hiss(c,t,{dur:.004*len,f0:hi*rnd(.8,1.25),q:.9,vol,att:.0008,pan});
 hiss(c,t+.0015,{dur:.018*len,f0:body*rnd(.85,1.15),q:5,vol:vol*.7,att:.001,pan});
}
const pile=(n:number,span:number,curve=1.6)=>Array.from({length:n},()=>Math.pow(Math.random(),curve)*span).sort((a,b)=>a-b);
/** "2山で置く": a short clatter then a settling knock, once per stack. */
function stacks(c:BaseAudioContext,t:number,count:number){
 for(let s=0;s<count;s++){const st=t+s*.13;for(const x of pile(count>2?6:4,.05,1))chip(c,st+x,{vol:.2,pan:rnd(-.2,.2)});chip(c,st+.06,{vol:.26,body:1050,len:1.6});}
}

/** Plays one effect and returns roughly how long it lasts in milliseconds. */
export function playTableEffect(c:BaseAudioContext,kind:EffectKind):number{
 const t=c.currentTime+.01;
 switch(kind){
  case 'deal':for(let i=0;i<3;i++)hiss(c,t+i*.15,{dur:.1,f0:1200,f1:2600,q:.9,vol:.32,att:.008,pan:-.2+i*.2,lp:4000});return 450;
  case 'fold':hiss(c,t,{dur:.12,f0:2400,f1:4000,q:.7,vol:.14,att:.03,lp:5000});return 200;
  case 'check':
   thump(c,t,{f:180,f1:95,dur:.09,vol:.45});hiss(c,t,{dur:.04,f0:400,q:.8,vol:.2,att:.002,lp:900});
   thump(c,t+.16,{f:170,f1:90,dur:.08,vol:.32});hiss(c,t+.16,{dur:.035,f0:400,q:.8,vol:.14,att:.002,lp:900});return 300;
  case 'call':stacks(c,t,2);return 350;
  case 'bet':stacks(c,t,3);return 450;
  case 'raise':stacks(c,t,4);return 600;
  case 'allin':
   hiss(c,t,{dur:.45,f0:3000,q:.6,vol:.08,att:.04});for(const x of pile(34,.45,1.1))chip(c,t+x,{vol:.2,pan:rnd(-.4,.4),len:.8});
   thump(c,t+.47,{f:120,f1:65,dur:.18,vol:.4});chip(c,t+.47,{vol:.28,body:950,len:1.8});return 750;
  case 'win':
   // Pot win = the shove with a short rising fanfare (owner pick, 2026/10/26).
   hiss(c,t,{dur:.35,f0:3200,q:.6,vol:.07,att:.03});for(const x of pile(26,.35,1.2))chip(c,t+x,{vol:.2,pan:rnd(-.4,.4),len:.8});
   [392,493.9,587.3,784].forEach((f,i)=>thump(c,t+.4+i*.07,{f,f1:f,dur:.45,vol:.07,type:'triangle'}));return 1100;
 }
}

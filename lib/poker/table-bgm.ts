/** Table BGM "High Roller" (owner pick, 2026/10/27): four-on-the-floor kick, open hats, claps, offbeat bass
 * and electric piano stabs over Am7 | Dm7 | G7 | Cmaj7 at 116 BPM. Synthesized in the browser; no audio files. */
const BPM=116,SPB=60/BPM,BAR=4*SPB,LOOKAHEAD=.3;
const mtof=(m:number)=>440*Math.pow(2,(m-69)/12);
const CHORDS=[[57,60,64,67],[50,53,57,60],[55,59,62,65],[48,52,55,59]],ROOTS=[45,38,43,36];

export class TableBgm{
 #ctx:AudioContext|null=null;#master:GainNode|null=null;#verb:ConvolverNode|null=null;#noise:AudioBuffer|null=null;
 #timer:ReturnType<typeof setInterval>|null=null;#starting=false;#wanted=false;#stopped=0;#next=0;#bar=0;#volume=.35;
 constructor(private factory:()=>AudioContext=()=>new AudioContext()){}
 get playing(){return this.#timer!==null;}
 /** Must be called from a user gesture the first time (browser autoplay rules). */
 async start(){
  if(this.#timer)return;
  // Resume on every call: a resume() made outside a tap can stay pending for good (Chrome, iOS Safari), so each later
  // tap must ask again from inside the gesture instead of waiting on the first attempt.
  let c:AudioContext;
  try{
   c=this.#ctx??=this.factory();
   const session=(globalThis.navigator as {audioSession?:{type:string}}|undefined)?.audioSession;
   // iPhone: play through the silent switch like other game audio (Safari 17+).
   if(session&&session.type!=='playback')try{session.type='playback';}catch{/* optional */}
   if(c.state!=='running')void c.resume().then(()=>{if(!this.#starting&&!this.#timer&&this.#wanted&&c.state==='running')void this.start();},()=>{});
  }catch{return;}
  this.#wanted=true;
  if(this.#starting)return;this.#starting=true;
  try{
   const ticket=this.#stopped;
   // Wait briefly for the browser to allow audio (a later tap may be what allows it); never wait forever.
   for(let waited=0;c.state!=='running'&&waited<1500&&ticket===this.#stopped;waited+=50)await new Promise(r=>setTimeout(r,50));
   if(c.state!=='running'||ticket!==this.#stopped)return;
   if(!this.#master){
    // Clean output (owner 2026/10/27: 音割れ): cut the sub-bass that small speakers distort on, then a firm limiter
    // so the sum of kick, bass and chords never pushes the device; the output stays well under full scale.
    const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=70;hp.Q.value=.7;
    const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=6;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.25;
    const out=c.createGain();out.gain.value=.5;hp.connect(comp);comp.connect(out);out.connect(c.destination);
    this.#master=c.createGain();this.#master.connect(hp);
    const len=Math.floor(c.sampleRate*2.2),ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
    this.#verb=c.createConvolver();this.#verb.buffer=ir;const wet=c.createGain();wet.gain.value=.3;this.#verb.connect(wet);wet.connect(this.#master);
    this.#noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const n=this.#noise.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=Math.random()*2-1;
   }
   const now=c.currentTime;this.#master.gain.cancelScheduledValues(now);this.#master.gain.setValueAtTime(0,now);this.#master.gain.linearRampToValueAtTime(this.#volume,now+1.5);
   if(this.#timer)return;this.#next=now+.1;this.#bar=0;this.#timer=setInterval(()=>this.#schedule(),50);this.#schedule();
  }catch{/* BGM is optional; it must never break the table. */}
  finally{this.#starting=false;}
 }
 stop(){
  this.#wanted=false;this.#stopped++;if(this.#timer)clearInterval(this.#timer);this.#timer=null;
  const c=this.#ctx,m=this.#master;if(c&&m){const now=c.currentTime;m.gain.cancelScheduledValues(now);m.gain.setValueAtTime(m.gain.value,now);m.gain.linearRampToValueAtTime(0,now+.4);}
 }
 /** 0〜1 of the loudest level; 0.7 is the original level. Applies smoothly while playing. */
 setVolume(level:number){this.#volume=.5*Math.min(1,Math.max(0,level));const c=this.#ctx,m=this.#master;if(c&&m&&this.#timer){const now=c.currentTime;m.gain.cancelScheduledValues(now);m.gain.setTargetAtTime(this.#volume,now,.06);}}
 close(){this.stop();const c=this.#ctx;this.#ctx=null;this.#master=null;if(c)setTimeout(()=>void c.close().catch(()=>{}),500);}
 #schedule(){const c=this.#ctx;if(!c)return;while(this.#next<c.currentTime+LOOKAHEAD){this.#playBar(this.#next,this.#bar++);this.#next+=BAR;}}
 #out(g:AudioNode,pan=0,send=.3){const c=this.#ctx!,p=c.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(this.#master!);if(send>0){const s=c.createGain();s.gain.value=send;p.connect(s);s.connect(this.#verb!);}}
 #env(g:GainNode,t:number,a:number,peak:number,d:number){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.setTargetAtTime(0,t+a,d/3);}
 #osc(type:OscillatorType,f:number,t:number,stop:number){const o=this.#ctx!.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(stop);return o;}
 #hiss(t:number,len:number,{f=8000,q=1,type='bandpass' as BiquadFilterType,vol=.1,a=.002,pan=0,send=.2}={}){
  const c=this.#ctx!,s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=this.#noise;fl.type=type;fl.frequency.value=f;fl.Q.value=q;this.#env(g,t,a,vol,len);
  s.connect(fl);fl.connect(g);this.#out(g,pan,send);s.start(t,Math.random());s.stop(t+len+.5);
 }
 #kick(t:number,v:number){const c=this.#ctx!,g=c.createGain();this.#env(g,t,.002,.5*v,.22);const o=this.#osc('sine',150,t,t+.5);o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(60,t+.12);o.connect(g);this.#out(g,0,0);}
 #hat(t:number,v:number,open:boolean){this.#hiss(t,open?.22:.04,{f:10000,q:.8,type:'highpass',vol:.05*v,pan:.25,send:.05});}
 #clap(t:number,v:number){for(const d of [0,.012,.024])this.#hiss(t+d,.09,{f:1500,q:1,vol:.06*v,send:.4});}
 #bass(m:number,t:number,len:number,v:number){
  const c=this.#ctx!,f=mtof(m),g=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=700;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.24*v,t+.008);g.gain.setTargetAtTime(.12*v,t+.008,len*.4);g.gain.setTargetAtTime(0,t+len*.9,.03);
  const a=this.#osc('sine',f,t,t+len+.3),b=this.#osc('triangle',f,t,t+len+.3),bg=c.createGain();bg.gain.value=.35;a.connect(lp);b.connect(bg);bg.connect(lp);lp.connect(g);this.#out(g,0,.05);
 }
 #ep(m:number,t:number,len:number,v:number,pan:number){
  const c=this.#ctx!,f=mtof(m),g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16*v,t+.006);g.gain.setTargetAtTime(.056*v,t+.006,.45);g.gain.setTargetAtTime(0,t+len,.15);
  const a=this.#osc('sine',f,t,t+len+1),b=this.#osc('sine',f*2,t,t+len+1),tine=this.#osc('sine',f*7.1,t,t+.25),tg=c.createGain(),bg=c.createGain();
  bg.gain.value=.18;tg.gain.setValueAtTime(.07*v,t);tg.gain.exponentialRampToValueAtTime(.0001,t+.2);a.connect(g);b.connect(bg);bg.connect(g);tine.connect(tg);tg.connect(g);this.#out(g,pan,.45);
 }
 #playBar(t:number,i:number){
  const ch=CHORDS[i%4],root=ROOTS[i%4];
  for(let b=0;b<4;b++){this.#kick(t+b*SPB,.85);this.#hat(t+(b+.5)*SPB,.8,true);this.#hat(t+b*SPB,.35,false);}
  this.#clap(t+SPB,.8);this.#clap(t+3*SPB,.8);
  for(let b=0;b<4;b++)this.#bass(root,t+(b+.5)*SPB,SPB*.4,.75);
  for(const b of [.5,1.75,2.5,3.5])ch.forEach((m,k)=>this.#ep(m+12,t+b*SPB+k*.004,SPB*.25,.5,(k-1.5)*.3));
  if(i%4===3)this.#hiss(t+2*SPB,2*SPB,{f:600,q:.5,type:'highpass',vol:.03,a:2*SPB,send:.4});
 }
}

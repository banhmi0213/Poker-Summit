/** Browser-only synthesized effects, matching the existing demo. No audio files or network I/O. */
export type PokerSound='turn'|'action'|'deal'|'win'|'enter'|'exit';
export class PokerSounds {
 #context:AudioContext|null=null;#enabled=true;#closed=false;
 constructor(private factory:()=>AudioContext=()=>new AudioContext()){}
 setEnabled(enabled:boolean){this.#enabled=enabled;}
 async unlock(){
  if(this.#closed)return;
  try{this.#context??=this.factory();if(this.#context.state==='suspended')await this.#context.resume();}catch{/* Optional audio cannot block a game. */}
 }
 play(kind:PokerSound):number {
  const c=this.#context;if(this.#closed||!this.#enabled||!c||c.state!=='running')return 0;
  try{
   const now=c.currentTime;
   const tone=(frequency:number,delay:number,duration:number,volume:number,wave:OscillatorType='sine')=>{
    const oscillator=c.createOscillator(),gain=c.createGain(),start=now+delay;
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(c.destination);oscillator.start(start);oscillator.stop(start+duration+.015);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   };
   if(kind==='turn'){tone(880,0,.13,.12);tone(1174.66,.045,.15,.065);}
   else if(kind==='action')tone(310,0,.085,.085,'triangle');
   else if(kind==='deal'){
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.15),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    for(const delay of [0,.12]){const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),start=now+delay;
     source.buffer=buffer;filter.type='bandpass';filter.frequency.value=2400;filter.Q.value=.65;
     gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.13,start+.014);gain.gain.exponentialRampToValueAtTime(.0001,start+.105);
     source.connect(filter);filter.connect(gain);gain.connect(c.destination);source.start(start);source.stop(start+.12);
     source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    }
   }else if(kind==='win')[659.25,830.61,987.77].forEach((f,i)=>tone(f,i*.115,.3,.10));
   else if(kind==='enter'){tone(523.25,0,.15,.08);tone(783.99,.11,.20,.09);}
   else{tone(659.25,0,.13,.08);tone(440,.10,.20,.08);}
   return kind==='exit'?350:kind==='win'?550:300;
  }catch{return 0;}
 }
 close(){this.#closed=true;const c=this.#context;this.#context=null;if(c)void c.close().catch(()=>{});}
}

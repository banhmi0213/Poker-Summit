import {seOutput} from './se-output';
import {type ActionKind} from './action-feedback';
import {playTableEffect} from './table-effects';
import {preloadTableSamples} from './table-samples';
/** Browser-only synthesized effects, matching the existing demo. No audio files or network I/O. */
/** 'turn' = it is your turn; 'turnCard' = the turn card appears on the board. */
export type PokerSound='turn'|'action'|'deal'|'flop'|'turnCard'|'river'|'win'|'enter'|'exit'|'stamp'|ActionKind;
/** Board sound for a board that just grew to `count` cards (null for a new hand / no board). */
export const boardSound=(count:number):PokerSound|null=>count===3?'flop':count===4?'turnCard':count===5?'river':null;
export class PokerSounds {
 #context:AudioContext|null=null;#enabled=true;#closed=false;
 constructor(private factory:()=>AudioContext=()=>new AudioContext()){}
 setEnabled(enabled:boolean){this.#enabled=enabled;}
 async unlock(){
  if(this.#closed)return;
  try{this.#context??=this.factory();preloadTableSamples(this.#context);if(this.#context.state==='suspended')await this.#context.resume();}catch{/* Optional audio cannot block a game. */}
 }
 play(kind:PokerSound):number {
  const c=this.#context;if(this.#closed||!this.#enabled||!c||c.state!=='running')return 0;
  try{
   const now=c.currentTime;
   const tone=(frequency:number,delay:number,duration:number,volume:number,wave:OscillatorType='sine')=>{
    const oscillator=c.createOscillator(),gain=c.createGain(),start=now+delay;
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(seOutput(c));oscillator.start(start);oscillator.stop(start+duration+.015);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   };
   if(kind==='turnCard')return playTableEffect(c,'turn');
   if(['fold','check','call','bet','raise','allin','deal','flop','river','win','stamp'].includes(kind))return playTableEffect(c,kind as ActionKind|'deal'|'flop'|'river'|'win'|'stamp');
   // Owner 2026/10/29 (カードが出る前のピコンみたいな音いらん): the your-turn ping is silent.
   if(kind==='turn')return 0;
   else if(kind==='action')tone(310,0,.085,.085,'triangle');
   else if(kind==='enter'){tone(523.25,0,.15,.08);tone(783.99,.11,.20,.09);}
   else{tone(659.25,0,.13,.08);tone(440,.10,.20,.08);}
   return kind==='exit'?350:300;
  }catch{return 0;}
 }
 close(){this.#closed=true;const c=this.#context;this.#context=null;if(c)void c.close().catch(()=>{});}
}

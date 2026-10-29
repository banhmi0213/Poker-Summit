/** Recorded table sounds chosen by the owner (2026/10/29): the three-card sound for dealing and the flop, the one-card
 * sound for the turn and the river. Loaded once per audio context from /sounds; until a file is ready (or if it cannot
 * load) the synthesized sound plays instead, so a missing file never silences the table. */
import {seOutput} from './se-output';
export type SampleName='three'|'one';
const FILES:Record<SampleName,string>={three:'/sounds/cards-three.mp3',one:'/sounds/card-one.mp3'};
type Slot=AudioBuffer|'loading'|'failed';
const loaded=new WeakMap<BaseAudioContext,Partial<Record<SampleName,Slot>>>();
function canLoad(c:BaseAudioContext){return typeof window!=='undefined'&&typeof fetch==='function'&&typeof (c as AudioContext).decodeAudioData==='function';}
/** Start loading every recorded sound for this context (safe to call often). */
export function preloadTableSamples(c:BaseAudioContext){
 if(!canLoad(c))return;let slots=loaded.get(c);if(!slots){slots={};loaded.set(c,slots);}
 for(const name of Object.keys(FILES) as SampleName[]){
  if(slots[name])continue;slots[name]='loading';const own=slots;
  void fetch(FILES[name]).then(r=>{if(!r.ok)throw Error('missing');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).then(buf=>{own[name]=buf;},()=>{own[name]='failed';});
 }
}
/** Plays a recorded sound now and returns its length in ms, or null when it is not ready (play the synth instead). */
export function playTableSample(c:BaseAudioContext,name:SampleName,at:number):number|null{
 preloadTableSamples(c);const buf=loaded.get(c)?.[name];
 if(!buf||typeof buf==='string')return null;
 try{const s=c.createBufferSource(),g=c.createGain();s.buffer=buf;g.gain.value=1;s.connect(g);g.connect(seOutput(c));s.start(at);s.onended=()=>{s.disconnect();g.disconnect();};return Math.round(buf.duration*1000);}catch{return null;}
}

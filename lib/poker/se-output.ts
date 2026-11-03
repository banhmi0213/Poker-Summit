/** Sound effects go through one volume node per audio context, following the 効果音の音量 setting. */
import {getSoundSettings,subscribeSoundSettings} from './sound-settings';
const outputs=new WeakMap<BaseAudioContext,GainNode>();
export const seLevel=()=>Math.min(1,Math.max(0,getSoundSettings().seVolume/100));
export function seOutput(c:BaseAudioContext):AudioNode{
 let g=outputs.get(c);if(g)return g;
 try{g=c.createGain();g.gain.value=seLevel();g.connect(c.destination);outputs.set(c,g);
  const node=g;subscribeSoundSettings(()=>{try{node.gain.setValueAtTime(seLevel(),c.currentTime);}catch{node.gain.value=seLevel();}});
  return g;}catch{return c.destination;}
}

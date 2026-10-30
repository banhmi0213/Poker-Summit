/** Server-side loader for the GTO data in public/poker-gto (CPU tables run in Node). */
import fs from 'node:fs';
import path from 'node:path';
import type {GtoData,PreflopData} from './gto-bot';
import type {FlopData} from './gto-spots';

export function loadGtoData(root=path.join(process.cwd(),'public','poker-gto')):GtoData|null{
 try{
  const preflop=JSON.parse(fs.readFileSync(path.join(root,'preflop.json'),'utf8')) as PreflopData;
  let preflopHu:PreflopData|undefined;try{preflopHu=JSON.parse(fs.readFileSync(path.join(root,'preflop-hu.json'),'utf8'));}catch{/* no heads-up chart */}
  const preflopDepths:Record<number,PreflopData>={};for(const d of [60,40,20,10]){try{preflopDepths[d]=JSON.parse(fs.readFileSync(path.join(root,`preflop-${d}bb.json`),'utf8'));}catch{/* not computed */}}
  let flopIndex:Record<string,string[]>={};try{flopIndex=JSON.parse(fs.readFileSync(path.join(root,'flops','index.json'),'utf8'));}catch{/* no flops yet */}
  const cache=new Map<string,FlopData|null>();
  return {preflop,preflopHu,preflopDepths,flopIndex,flop(spot,flop){
   const k=spot+'/'+flop;if(cache.has(k))return cache.get(k)!;
   if(!/^[a-z0-9-]+$/.test(spot)||!/^[2-9TJQKA][cdhs][2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/.test(flop))return null;
   let d:FlopData|null=null;try{d=JSON.parse(fs.readFileSync(path.join(root,'flops',spot,flop+'.json'),'utf8'));}catch{d=null;}
   cache.set(k,d);if(cache.size>200)cache.delete(cache.keys().next().value as string);return d;}};
 }catch{return null;}
}

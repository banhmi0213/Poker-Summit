/** Display preferences only. Engine/legal limits remain authoritative. */
/** runItTwice: answer to the ring all-in run-twice question — ask each time, or answer automatically. */
export type RunItTwicePreference='ask'|'twice'|'once';
export type BetPreferences={bb:boolean;multipliers:number[];potPercentages:number[];runItTwice:RunItTwicePreference};
export const defaultBetPreferences:BetPreferences={bb:false,multipliers:[2.5,3,4],potPercentages:[33,50,75,100],runItTwice:'ask'};
export function parseBetPreferences(input:unknown):BetPreferences{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid preferences');const v=input as Record<string,unknown>;
 const list=(x:unknown,length:number,min:number,max:number)=>{if(!Array.isArray(x)||x.length!==length||!x.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max&&Math.abs(Math.round(n*100)-n*100)<0.000001))throw Error('Invalid bet sizes');return [...x] as number[];};
 if(typeof v.bb!=='boolean')throw Error('Invalid BB preference');
 // Older saved settings have no run-twice field: they mean "ask each time".
 const runItTwice=v.runItTwice===undefined?'ask':v.runItTwice;if(runItTwice!=='ask'&&runItTwice!=='twice'&&runItTwice!=='once')throw Error('Invalid run-twice preference');
 return {bb:v.bb,multipliers:list(v.multipliers,3,1,20),potPercentages:list(v.potPercentages,4,1,500),runItTwice};
}
/** A pot raise uses the pot AFTER calling, plus call and current contribution. */
export function presetRaiseTo({preflop,value,bb,pot,call,committed,min,max}:{preflop:boolean;value:number;bb:number;pot:number;call:number;committed:number;min:number;max:number}){
 const target=preflop?Math.round(value*bb):committed+call+Math.round((pot+call)*value/100);
 return Math.min(max,Math.max(min,target));
}

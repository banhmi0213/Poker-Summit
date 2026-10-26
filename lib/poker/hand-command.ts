/** Shared strict grammar; contains no engine, authentication or server imports. */
import type {BettingAction} from './betting';
/** Run-it-twice answer from a player in an all-in runout (ring only). */
export type RunsChoice={type:'runs';count:1|2};
export type Command={handId:string;revision:number;actionId:string;action:BettingAction|RunsChoice};
function object(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid command");
  return value as Record<string,unknown>;
}
function exact(value:Record<string,unknown>,keys:string[]) {
  if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new Error("Unexpected command fields");
}
export function parseHandCommand(input:unknown):Command {
  const c=object(input);exact(c,["handId","revision","actionId","action"]);
  if(typeof c.handId!=="string"||typeof c.actionId!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(c.actionId)||!Number.isSafeInteger(c.revision)||Number(c.revision)<0)throw new Error("Invalid command identity");
  const a=object(c.action),type=a.type;
  if(type==="fold"||type==="check"||type==="call")exact(a,["type"]);
  else if(type==="bet"||type==="raise") {exact(a,["type","amount"]);if(!Number.isSafeInteger(a.amount)||Number(a.amount)<=0)throw new Error("Invalid wager");}
  else if(type==="runs") {exact(a,["type","count"]);if(a.count!==1&&a.count!==2)throw new Error("Invalid run count");return {handId:c.handId,revision:Number(c.revision),actionId:c.actionId,action:{type:"runs",count:a.count}};}
  else throw new Error("Unknown action");
  return {handId:c.handId,revision:Number(c.revision),actionId:c.actionId,action:type==="bet"||type==="raise"?{type,amount:Number(a.amount)}:{type} as BettingAction};
}

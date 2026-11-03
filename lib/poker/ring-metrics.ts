/** Fixed labels and durations only: never log identity, credentials or game data. */
export type RingMetric={type:'ring_timing';stage:string;operation:string;durationMs:number;ok:boolean};
export type RingMetricSink=(event:RingMetric)=>void;
export async function measureRing<T>(sink:RingMetricSink|undefined,stage:string,operation:string,work:()=>PromiseLike<T>,succeeded:(value:T)=>boolean=()=>true):Promise<T>{
 const start=performance.now();let ok=false;
 try{const value=await work();ok=succeeded(value);return value;}
 finally{try{sink?.({type:'ring_timing',stage,operation,durationMs:Math.round(performance.now()-start),ok});}catch{/* Diagnostics cannot change transaction results. */}}
}

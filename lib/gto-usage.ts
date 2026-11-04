/** The same tool IDs are shared by the recorder, dashboard and SQL constraint. */
export const GTO_TOOLS = {
 preflop: 'プリフロップ表', flop: 'フロップ戦略', hand: '1ハンド通して対戦', drill: 'プリフロップ連打',
 ranges: 'レンジ練習', weak: '弱点分析', curve: '収支グラフ', quiz: '学習クイズ', calculator: '学習計算機', lesson: '学習レッスン',
} as const;
export type GtoTool = keyof typeof GTO_TOOLS;
export type GtoAction = 'open' | 'start' | 'answer';
export type UsageEvent = {created_at:string;visitor_id:string;member_id:string|null;tool:GtoTool;action:GtoAction;device:'mobile'|'pc'};
export const TOOL_IDS = Object.keys(GTO_TOOLS) as GtoTool[];
export const isTool = (v:unknown):v is GtoTool => typeof v==='string' && Object.prototype.hasOwnProperty.call(GTO_TOOLS,v);
export const isAction = (v:unknown):v is GtoAction => v==='open'||v==='start'||v==='answer';
const DAY=86400000;
export const jstDay=(iso:string|number=Date.now())=>new Date(new Date(iso).getTime()+9*3600000).toISOString().slice(0,10);
const midnight=(d:string)=>Date.parse(d+'T00:00:00+09:00');
export function usagePeriod(mode:'daily'|'monthly',input?:string){
 const fallback=jstDay(),raw=input??'';
 const valid=mode==='daily'?/^\d{4}-\d{2}-\d{2}$/.test(raw):/^\d{4}-\d{2}$/.test(raw);
 const date=valid?(mode==='daily'?raw:raw+'-01'):(mode==='daily'?fallback:fallback.slice(0,7)+'-01');
 const safe=Number.isFinite(midnight(date))&&jstDay(midnight(date))===date?date:(mode==='daily'?fallback:fallback.slice(0,7)+'-01');
 const start=midnight(safe),year=Number(safe.slice(0,4)),month=Number(safe.slice(5,7));
 const monthAt=(offset:number)=>Date.UTC(year,month-1+offset,1)-9*3600000;
 const end=mode==='daily'?start+DAY:monthAt(1),previous=mode==='daily'?start-DAY:monthAt(-1);
 const buckets=Array.from({length:mode==='daily'?30:12},(_,i)=>mode==='daily'?start-(29-i)*DAY:monthAt(i-11));
 return {mode,value:mode==='daily'?safe:safe.slice(0,7),start,end,previous,buckets,trendStart:buckets[0]};
}
export type UsagePeriod=ReturnType<typeof usagePeriod>;
export function summarizeUsage(rows:UsageEvent[]){
 const visitors=new Set<string>(),members=new Set<string>(),mobile=new Set<string>(),pc=new Set<string>();
 let pv=0,starts=0,answers=0;
 for(const r of rows){visitors.add(r.visitor_id);if(r.member_id)members.add(r.member_id);(r.device==='mobile'?mobile:pc).add(r.visitor_id);if(r.action==='open')pv++;if(r.action==='start')starts++;if(r.action==='answer')answers++;}
 return {uu:visitors.size,members:members.size,pv,starts,answers,mobile:mobile.size,pc:pc.size};
}
export type UsageSummary=ReturnType<typeof summarizeUsage>;
export function usageReport(rows:UsageEvent[],period:UsagePeriod){
 const current=rows.filter(r=>Date.parse(r.created_at)>=period.start&&Date.parse(r.created_at)<period.end);
 const before=rows.filter(r=>Date.parse(r.created_at)>=period.previous&&Date.parse(r.created_at)<period.start);
 const tools=TOOL_IDS.map(tool=>({tool,label:GTO_TOOLS[tool],...summarizeUsage(current.filter(r=>r.tool===tool)),previous:summarizeUsage(before.filter(r=>r.tool===tool))}));
 const trend=period.buckets.map((start,i)=>{const end=period.buckets[i+1]??period.end;const inBucket=rows.filter(r=>Date.parse(r.created_at)>=start&&Date.parse(r.created_at)<end);return {date:jstDay(start),values:Object.fromEntries(TOOL_IDS.map(t=>[t,new Set(inBucket.filter(r=>r.tool===t).map(r=>r.visitor_id)).size])) as Record<GtoTool,number>};});
 return {tools,total:summarizeUsage(current),previous:summarizeUsage(before),trend};
}
export function usageDelta(now:number,before:number){const change=now-before;return {change,percent:before?change/before*100:null};}
export function usageCsv(report:ReturnType<typeof usageReport>,period:UsagePeriod){
 const header=['期間','道具','使った人数','うちログインした人数','開いた回数','始めた回数','答えた回数',period.mode==='daily'?'前日比（人数）':'前月比（人数）','増減率（%）','スマホ人数','PC人数'];
 const rows=[...report.tools,{label:'GTO全体（人数は重複除外）',...report.total,previous:report.previous}].map(r=>{const d=usageDelta(r.uu,r.previous.uu);return [period.value,r.label,r.uu,r.members,r.pv,r.starts,r.answers,d.change,d.percent===null?'比較元0':d.percent.toFixed(1),r.mobile,r.pc];});
 return '\uFEFF'+[header,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
}

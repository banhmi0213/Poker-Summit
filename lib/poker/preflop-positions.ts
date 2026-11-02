import preflop from '@/public/poker-gto/preflop.json';

/** ポジション別のプリフロップ解説ページ (owner 2026/10/31): each page shows one chart of the 6-max 100BB solve in full —
 * the open chart for UTG〜SB, and the defence against a BTN open for BB. Server only (the chart file is large). */
export type PreflopAction={label:string;kind:string};
export type PreflopNode={id:number;player:string;history:string;kind:string;title:string;actions:PreflopAction[];strategy:Record<string,number[]>};
type PreflopFile={iterations:number;averageRegret:number;assumptions:string[];nodes:PreflopNode[]};
const data=preflop as unknown as PreflopFile;

export const POSITION_SLUGS=['utg','hj','co','btn','sb','bb'] as const;
export type PositionSlug=typeof POSITION_SLUGS[number];
export const POSITION_NAME:Record<PositionSlug,string>={utg:'UTG',hj:'HJ',co:'CO',btn:'BTN',sb:'SB',bb:'BB'};

/** The chart shown on each position's page. */
export function positionNode(slug:PositionSlug):PreflopNode|null{
 const pos=POSITION_NAME[slug];
 if(slug==='bb')return data.nodes.find(n=>n.kind==='vsOpen'&&n.player==='BB'&&/BTN2\.5/.test(n.history)&&/SBF/.test(n.history))??null;
 return data.nodes.find(n=>n.kind==='open'&&n.player===pos)??null;
}

export const RANKS='AKQJT98765432';
export const handLabel=(i:number,j:number)=>i===j?RANKS[i]+RANKS[j]:i<j?RANKS[i]+RANKS[j]+'s':RANKS[j]+RANKS[i]+'o';
const combos=(l:string)=>l.length===2?6:l[2]==='s'?4:12;

/** Share of all 1326 starting hands taking each action. */
export function actionTotals(n:PreflopNode){
 const t=new Array(n.actions.length).fill(0);let all=0;
 for(const [l,v] of Object.entries(n.strategy)){const c=combos(l);all+=c;v.forEach((x,i)=>{t[i]+=c*x;});}
 return t.map(x=>all?x/all:0);
}

export function chartAssumptions(){return {assumptions:data.assumptions,iterations:data.iterations,averageRegret:data.averageRegret};}

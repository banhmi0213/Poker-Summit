/** Display colours only. Frequencies and solver actions are never modified. */
export type StrategyAction={kind:string;label:string};
export const STRATEGY_COLORS={fold:'#D6DFE8',passive:'#91D6C8',smallBet:'#F3CE78',largeBet:'#F2A478',raise:'#CAA0D9',allin:'#EE91A2'} as const;
export function strategyColor(action:StrategyAction,actions:readonly StrategyAction[]=[]):string{
 if(action.kind==='allin'||/オールイン|all[ -]?in/i.test(action.label))return STRATEGY_COLORS.allin;
 if(action.kind==='fold')return STRATEGY_COLORS.fold;
 if(action.kind==='check'||action.kind==='call')return STRATEGY_COLORS.passive;
 if(action.kind==='raise')return STRATEGY_COLORS.raise;
 if(action.kind==='bet'){
  const match=action.label.match(/([\d.]+)\s*%/);
  if(match)return Number(match[1])<=40?STRATEGY_COLORS.smallBet:STRATEGY_COLORS.largeBet;
  const bets=actions.filter(a=>a.kind==='bet');
  return bets.indexOf(action)>0?STRATEGY_COLORS.largeBet:STRATEGY_COLORS.smallBet;
 }
 return STRATEGY_COLORS.fold;
}

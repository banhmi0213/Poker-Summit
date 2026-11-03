import type {BettingAction} from './betting';

/** Amounts are total street commitments, including an already posted blind. */
export function ringWagerAction(hand:{players:readonly {committed:number}[]},amount:number):BettingAction {
 return {type:hand.players.some(p=>p.committed>0)?'raise':'bet',amount};
}

/** Shared by the authority and browser; no engine or platform imports. */
export const RUNOUT_STEP_MS=2200;
export const PAYOUT_ANIMATION_MS=1200;
export function runoutDuration(fromBoardCount:number){return (1+[3,4,5].filter(n=>n>fromBoardCount).length)*RUNOUT_STEP_MS;}

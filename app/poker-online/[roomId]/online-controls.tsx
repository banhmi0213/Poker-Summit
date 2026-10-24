
'use client';
import type {PlayerSnapshot} from '@/lib/poker/player-client';
import type {BettingAction} from '@/lib/poker/betting';
import {BettingControls} from '@/app/poker-ui/betting-controls';
type Props={state:PlayerSnapshot|null;busy:boolean;pending:boolean;enabled:boolean;message:string;onJoin:()=>void;onSpectate:()=>void;onRetry:()=>void;onTimeBank?:()=>void;onAct:(action:BettingAction)=>void};
export function OnlineControls({state,busy,pending,enabled,message,onJoin,onSpectate,onRetry,onAct,onTimeBank}:Props){const locked=busy||pending||!enabled||Boolean(state?.turn&&state.turn.expiresAt<=state.serverNow);return <><p role="status">{message}</p>{!enabled&&<p>オンライン対戦サーバーはまだ公開していません。</p>}<details><summary>接続設定</summary><div><button type="button" disabled={busy||!enabled} onClick={onJoin}>参加・接続・再接続</button><button type="button" disabled={locked} onClick={onSpectate}>観戦</button>{pending&&<button type="button" disabled={busy} onClick={onRetry}>前の操作の結果を確認</button>}</div></details><BettingControls hand={state?.hand??null} blocked={locked} seconds={state?.turn?Math.max(0,Math.ceil((state.turn.expiresAt-state.serverNow)/1000)):null} bank={state?.timeBank??undefined} onTimeBank={onTimeBank} onAction={onAct}/></>;}

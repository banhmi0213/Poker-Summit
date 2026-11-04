import {loadHandStats} from '@/lib/poker/hand-histories';
import {OwnHudCard} from './own-hud-card';
export async function OwnHudSummary(){const data=await loadHandStats();return <OwnHudCard stats={data?.ring??null}/>;}

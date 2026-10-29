import {notFound} from "next/navigation";
import TournamentManager from "@/app/poker-tournaments/manager";
import {POKER_TOURNAMENTS_ENABLED} from "@/lib/poker/features";
import {saveTournament} from "./actions";
export default function Page(){if(!POKER_TOURNAMENTS_ENABLED)notFound();return <TournamentManager scope="store" action={saveTournament}/>;}

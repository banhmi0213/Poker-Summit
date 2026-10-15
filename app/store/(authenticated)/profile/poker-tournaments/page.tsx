import TournamentManager from "@/app/poker-tournaments/manager";
import {saveTournament} from "./actions";
export default function Page(){return <TournamentManager scope="store" action={saveTournament}/>;}

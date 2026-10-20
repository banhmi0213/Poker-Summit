import TournamentManager from "@/app/poker-tournaments/manager";
import {saveTournament,removeTournament} from "./actions";
export default function Page(){return <TournamentManager scope="admin" action={saveTournament,removeTournament}/>;}

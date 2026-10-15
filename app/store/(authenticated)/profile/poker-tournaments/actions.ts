"use server";
import {saveManagedTournament,type TournamentFormState} from "@/lib/poker/tournament-admin";
export async function saveTournament(_previous:TournamentFormState,form:FormData){return saveManagedTournament("store",form);}

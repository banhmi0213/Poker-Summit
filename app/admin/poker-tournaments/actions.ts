"use server";
import {saveManagedTournament,removeManagedTournament,type TournamentFormState} from "@/lib/poker/tournament-admin";
export async function saveTournament(_previous:TournamentFormState,form:FormData){return saveManagedTournament("admin",form);}

export async function removeTournament(_previous:TournamentFormState,form:FormData){return removeManagedTournament(form);}

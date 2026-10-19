'use server';
import {saveManagedRing,removeManagedRing} from '@/lib/poker/ring-admin';
import type {TournamentFormState} from '@/lib/poker/tournament-admin';
export async function saveRing(_state:TournamentFormState,form:FormData){return saveManagedRing(form);}
export async function removeRing(_state:TournamentFormState,form:FormData){return removeManagedRing(form);}

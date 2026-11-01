'use client';
// The member's ring rank and each table's rank condition (2026/11/01), for the lobby buttons and the auto move.
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseRingRank,type RingRank,type RingTierLimits} from '@/lib/poker/ring-rank';
export function useRingTiers(auth:SupabaseClient,member:string|null,tableIds:string){
 const [rank,setRank]=useState<RingRank|null>(null),[limits,setLimits]=useState<Map<string,RingTierLimits>>(new Map());
 useEffect(()=>{if(!member){setRank(null);return;}let live=true;
  try{void Promise.resolve(auth.rpc('poker_ring_rank')).then(({data,error})=>{if(live&&!error)setRank(parseRingRank(data));},()=>{});}catch{}
  return()=>{live=false;};},[auth,member]);
 useEffect(()=>{const ids=tableIds.split(',').filter(Boolean);if(!ids.length)return;let live=true;
  try{void Promise.resolve(auth.from('poker_ring_tables').select('id,min_tier,max_tier').in('id',ids)).then(({data,error})=>{if(!live||error||!Array.isArray(data))return;
   setLimits(new Map((data as {id:string;min_tier:number;max_tier:number}[]).map(r=>[r.id,{min:r.min_tier??0,max:r.max_tier??6}])));},()=>{});}catch{}
  return()=>{live=false;};},[auth,tableIds]);
 return {rank,limits};
}

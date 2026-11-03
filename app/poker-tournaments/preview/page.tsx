import {notFound} from 'next/navigation';
import {POKER_TOURNAMENTS_ENABLED} from '@/lib/poker/features';
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import Playground from "../playground";
export const metadata={title:"トーナメント設定プレビュー | Poker Summit",robots:{index:false,follow:false}};
export default async function Page(){if(!POKER_TOURNAMENTS_ENABLED)notFound();const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user&&process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")redirect("/signup");return <Playground serverNow={Date.now()}/>;}

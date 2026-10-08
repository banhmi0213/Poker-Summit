import {ChatRoom} from "@/app/matching/chat/page-content";
export const dynamic="force-dynamic";
export default function Page({params,searchParams}:{params:{id:string};searchParams:{page?:string}}){return <ChatRoom actor="dealer" id={params.id} page={searchParams.page}/>;}

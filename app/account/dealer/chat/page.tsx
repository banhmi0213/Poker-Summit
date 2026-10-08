import {ChatList} from "@/app/matching/chat/page-content";
export const dynamic="force-dynamic";
export default function Page({searchParams}:{searchParams:{page?:string}}){return <ChatList actor="dealer" page={searchParams.page}/>;}

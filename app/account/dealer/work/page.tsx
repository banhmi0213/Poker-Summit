import {WorkPage} from "@/app/matching/work/page-content";
export const dynamic="force-dynamic";
export default function Page({searchParams}:{searchParams:{page?:string;job?:string;saved?:string;record?:string}}){return WorkPage({actor:"dealer",searchParams});}

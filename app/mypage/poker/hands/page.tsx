import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
/** The hand list lives in the player page (owner 2026/11/03: the whole menu stays visible). Older links land there. */
export default function Page({searchParams}:{searchParams:{before?:string}}){
 redirect(`/mypage/poker?pane=hands${searchParams.before?`&before=${encodeURIComponent(searchParams.before)}`:''}`);
}

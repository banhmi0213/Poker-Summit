// アイコン枠(オーナー 2026/11/01)：サイト全体で使う、アイコンのまわりの枠。マイページ・サミット・ポーカーの卓・ロビーで同じ見た目にする。
// 枠はアイコンの外側に描く(outline)ので、中のアイコンや卓の持ち時間の輪には触れない。code は着せ替えのコード(frame_*)、null は枠なし。
import type {ReactNode} from 'react';
import {frameItem,frameStyle} from '@/lib/cosmetics';
export function AvatarFrame({code,children}:{code?:string|null;children:ReactNode}){
 const style=frameStyle(code);if(!style)return <>{children}</>;
 return <span data-avatar-frame={frameItem(code).id} style={{display:'inline-flex',flexShrink:0,lineHeight:0,...style}}>{children}</span>;
}

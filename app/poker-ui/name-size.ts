/** Owner 2026/10/31 (文字数少ない名前はバランス見て大きく): a size step for a seat name by its visual width
 * (full-width characters count 2, others 1). PC plates use it; phones keep one size.
 * Code-point ranges, not a regex literal: bundles served without a charset must not turn it into another range. */
const WIDE:[number,number][]=[[0x1100,0x115f],[0x2e80,0xa4cf],[0xac00,0xd7a3],[0xf900,0xfaff],[0xfe30,0xfe4f],[0xff00,0xff60],[0xffe0,0xffe6]];
export function nameSize(name:string|null|undefined):'s'|'m'|'l'{
 let w=0;for(const ch of name??''){const c=ch.codePointAt(0)??0;w+=WIDE.some(([a,b])=>c>=a&&c<=b)?2:1;}
 return w<=6?'s':w<=10?'m':'l';
}

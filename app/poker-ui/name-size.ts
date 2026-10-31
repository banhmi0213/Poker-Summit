/** Owner 2026/10/31 (文字数少ない名前はバランス見て大きく): a size step for a seat name by its visual width
 * (full-width characters count 2, others 1). PC plates use it; phones keep one size. */
export function nameSize(name:string|null|undefined):'s'|'m'|'l'{
 let w=0;for(const ch of name??'')w+=/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch)?2:1;
 return w<=6?'s':w<=10?'m':'l';
}

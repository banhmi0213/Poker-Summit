export function eventSignLabel(category: string | null | undefined): "TOURNAMENT" | "EVENT" {
 return /大会|トーナメント|tournament/i.test(category || "") ? "TOURNAMENT" : "EVENT";
}
export { nameWidth as eventTitleWidth } from "@/lib/name-layout";
import { nameTitleLines } from "@/lib/name-layout";
export function eventTitleLines(title: string): string[] {
 const name = title.trim().replace(/\s+/g, " ") || "タイトル未設定";
 const venueBreak = name.search(/[＠@]/);
 if (venueBreak > 0 && nameWidth(name.slice(0, venueBreak)) <= 14 && nameWidth(name.slice(venueBreak)) >= 2) return [name.slice(0, venueBreak).trim(), name.slice(venueBreak).trim()];
 return nameTitleLines(name, 11);
}
import { nameWidth } from "@/lib/name-layout";
export function eventSignDate(value:string | null | undefined) {
 if(!value)return "日時未定";
 const d=new Date(value);if(Number.isNaN(d.getTime()))return "日時未定";
 return `${d.toLocaleDateString("ja-JP",{month:"2-digit",day:"2-digit",timeZone:"Asia/Tokyo"})} ${d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"})}`;
}

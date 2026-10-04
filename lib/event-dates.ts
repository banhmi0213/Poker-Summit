/** Event form values are always Japanese local time, independent of server/browser timezone. */
export function toEventLocalInput(value:string | null | undefined):string {
 if(!value)return "";
 const date=new Date(value);if(Number.isNaN(date.getTime()))return "";
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value || "";
 return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function parseEventLocalInput(value:string):string|null {
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error("日時を正しく入力してください（日本時間）。");
 const date=new Date(`${value}:00+09:00`);
 if(Number.isNaN(date.getTime()) || toEventLocalInput(date.toISOString())!==value)throw new Error("日時を正しく入力してください（日本時間）。");
 return date.toISOString();
}
export function parseEventDates(start:string,end:string) {
 const start_at=parseEventLocalInput(start),end_at=parseEventLocalInput(end);
 if(start_at && end_at && end_at<start_at)throw new Error("終了日時は開始日時以降にしてください。");
 return {start_at,end_at};
}

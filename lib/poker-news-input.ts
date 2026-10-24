import { createHash } from "node:crypto";
export const NEWS_CATEGORIES=["国内大会","海外大会","大会結果","業界情報","配信・アプリ","未確認・参考"] as const;
export type NewsInput={import_key:string;title:string;summary:string;category:string;source_url:string;source_label:string;related_blog_id:string|null;news_date:string;active:boolean};
export function validNewsDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function parseNewsInput(value:unknown):NewsInput {
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("ニュースの形式を確認してください。");
 const v=value as Record<string,unknown>;
 function text(key:string,max:number,required=true){const s=v[key];if(s!==undefined&&s!==null&&typeof s!=="string")throw Error(`${key} は文字列で入力してください。`);const t=(s as string||"").trim();if((required&&!t)||t.length>max)throw Error(`${key} は${max}文字以内で入力してください。`);return t;}
 const title=text("title",200),summary=text("summary",600),category=text("category",30),source=text("source_url",2048);
 if(!NEWS_CATEGORIES.some(x=>x===category))throw Error("カテゴリを選択してください。");
 let url:URL;try{url=new URL(source);if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw Error();}catch{throw Error("参照先はhttpまたはhttpsのURLを入力してください。");}
 const related=text("related_blog_id",36,false)||null;
 if(related&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(related))throw Error("関連記事を選択してください。");
 const date=text("news_date",10);if(!validNewsDate(date))throw Error("日付を確認してください。");
 if(v.active!==undefined&&typeof v.active!=="boolean")throw Error("公開状態を確認してください。");
 const key=text("import_key",160,false)||createHash("sha256").update(url.href+"\n"+title).digest("hex");
 if(!/^[a-zA-Z0-9_-]+$/.test(key))throw Error("取込キーには半角英数字・ハイフン・アンダースコアを使用してください。");
 return {import_key:key,title,summary,category,source_url:url.href,source_label:text("source_label",60,false)||"情報元を見る",related_blog_id:related,news_date:date,active:v.active===true};
}
export function parseNewsBatch(raw:string){if(raw.length>500000)throw Error("取込データが大きすぎます。");const data=JSON.parse(raw);if(!Array.isArray(data)||!data.length||data.length>100)throw Error("1〜100件の配列で入力してください。");const rows=data.map(parseNewsInput);if(new Set(rows.map(x=>x.import_key)).size!==rows.length)throw Error("同じ取込キーが重複しています。");return rows;}
export function newsSearchText(q:string){return q.replace(/[^\p{L}\p{N}\s-]/gu," ").trim().slice(0,100);}

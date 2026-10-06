"use client";
import {useEffect,useRef,useState} from "react";
import {PREF_OPTIONS} from "@/lib/constants";
const COUNTRY_OPTIONS: string[]=["アイスランド","アイルランド","アゼルバイジャン","アフガニスタン","アメリカ合衆国","アラブ首長国連邦","アルジェリア","アルゼンチン","アルバ","アルバニア","アルメニア","アンギラ","アンゴラ","アンティグア・バーブーダ","アンドラ","イエメン","イギリス","イスラエル","イタリア","イラク","イラン","インド","インドネシア","ウォリス・フツナ","ウガンダ","ウクライナ","ウズベキスタン","ウルグアイ","エクアドル","エジプト","エストニア","エスワティニ","エチオピア","エリトリア","エルサルバドル","オーストラリア","オーストリア","オーランド諸島","オマーン","オランダ","オランダ領カリブ","ガーナ","カーボベルデ","ガーンジー","ガイアナ","カザフスタン","カタール","カナダ","ガボン","カメルーン","ガンビア","カンボジア","ギニア","ギニアビサウ","キプロス","キューバ","キュラソー","ギリシャ","キリバス","キルギス","グアテマラ","グアドループ","グアム","クウェート","クック諸島","グリーンランド","クリスマス島","グレナダ","クロアチア","ケイマン諸島","ケニア","コートジボワール","ココス(キーリング)諸島","コスタリカ","コモロ","コロンビア","コンゴ共和国(ブラザビル)","コンゴ民主共和国(キンシャサ)","サウジアラビア","サウスジョージア・サウスサンドウィッチ諸島","サモア","サン・バルテルミー","サン・マルタン","サントメ・プリンシペ","ザンビア","サンピエール島・ミクロン島","サンマリノ","シエラレオネ","ジブチ","ジブラルタル","ジャージー","ジャマイカ","ジョージア","シリア","シンガポール","シント・マールテン","ジンバブエ","スイス","スウェーデン","スーダン","スバールバル諸島・ヤンマイエン島","スペイン","スリナム","スリランカ","スロバキア","スロベニア","セーシェル","セネガル","セルビア","セントクリストファー・ネーヴィス","セントビンセント及びグレナディーン諸島","セントヘレナ","セントルシア","ソマリア","ソロモン諸島","タークス・カイコス諸島","タイ","タジキスタン","タンザニア","チェコ","チャド","チュニジア","チリ","ツバル","デンマーク","ドイツ","トーゴ","トケラウ","ドミニカ共和国","ドミニカ国","トリニダード・トバゴ","トルクメニスタン","トルコ","トンガ","ナイジェリア","ナウル","ナミビア","ニウエ","ニカラグア","ニジェール","ニューカレドニア","ニュージーランド","ネパール","ノーフォーク島","ノルウェー","ハード島・マクドナルド諸島","バーレーン","ハイチ","パキスタン","バチカン市国","パナマ","バヌアツ","バハマ","パプアニューギニア","バミューダ","パラオ","パラグアイ","バルバドス","パレスチナ自治区","ハンガリー","バングラデシュ","ピトケアン諸島","フィジー","フィリピン","フィンランド","ブータン","ブーベ島","プエルトリコ","フェロー諸島","フォークランド諸島","ブラジル","フランス","ブルガリア","ブルキナファソ","ブルネイ","ブルンジ","ベトナム","ベナン","ベネズエラ","ベラルーシ","ベリーズ","ペルー","ベルギー","ポーランド","ボスニア・ヘルツェゴビナ","ボツワナ","ボリビア","ポルトガル","ホンジュラス","マーシャル諸島","マダガスカル","マヨット","マラウイ","マリ","マルタ","マルティニーク","マレーシア","マン島","ミクロネシア連邦","ミャンマー (ビルマ)","メキシコ","モーリシャス","モーリタニア","モザンビーク","モナコ","モルディブ","モルドバ","モロッコ","モンゴル","モンテネグロ","モントセラト","ヨルダン","ラオス","ラトビア","リトアニア","リビア","リヒテンシュタイン","リベリア","ルーマニア","ルクセンブルク","ルワンダ","レソト","レバノン","レユニオン","ロシア","英領インド洋地域","英領ヴァージン諸島","韓国","合衆国領有小離島","西サハラ","赤道ギニア","台湾","中央アフリカ共和国","中華人民共和国マカオ特別行政区","中華人民共和国香港特別行政区","中国","東ティモール","南アフリカ","南スーダン","南極","仏領ギアナ","仏領ポリネシア","仏領極南諸島","米領ヴァージン諸島","米領サモア","北マケドニア","北マリアナ諸島","北朝鮮"];
import { useFormState,useFormStatus } from "react-dom";
import { saveTournament } from "./actions";
function Buttons(){const {pending}=useFormStatus();return <div style={{display:"flex",gap:8}}><button className="btn" name="intent" value="draft" disabled={pending}>下書き保存</button><button className="btn primary" name="intent" value="publish" disabled={pending}>公開する</button></div>;}
export function TournamentEditor({entry}:{entry?:{id:string;title:string;scope:string;location:string;venue:string;start_date:string|null;end_date:string|null;description:string;schedule:string;official_url:string}}){
 const formRef=useRef<HTMLFormElement>(null);
 const [state,action]=useFormState(saveTournament,{} as {error?:string;success?:string;id?:string});
 const [scope,setScope]=useState(entry?.scope==="海外"?"海外":"国内");
 const [locations,setLocations]=useState<Record<string,string>>({"国内":entry?.scope!=="海外"?entry?.location||"":"","海外":entry?.scope==="海外"?entry.location||"":""});
 useEffect(()=>{
  if(state.success&&!entry){
   formRef.current?.reset();
   setScope("国内");
   setLocations({"国内":"","海外":""});
  }
 },[state,entry]);
 const location=locations[scope]||"";
 const options=scope==="国内"?PREF_OPTIONS:COUNTRY_OPTIONS;
 return <form ref={formRef} action={action} className="card tournament-editor">
 <input type="hidden" name="id" value={entry?.id||""}/>
 <label className="wide">大会名 *<input name="title" required maxLength={160} defaultValue={entry?.title} placeholder="例：JAPAN POKER FESTIVAL 2026"/></label>
 <label>開催区分<select name="scope" value={scope} onChange={e=>setScope(e.target.value)}><option>国内</option><option>海外</option></select></label>
 <label>地域・国<select name="location" value={location} onChange={e=>setLocations(prev=>({...prev,[scope]:e.target.value}))}><option value="">{scope==="国内"?"都道府県を選択":"国を選択"}</option>{location&&!options.includes(location)&&<option value={location}>{location}（登録済み）</option>}{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
 <label>会場<input name="venue" maxLength={300} defaultValue={entry?.venue} placeholder="会場名を入力"/></label>
 <label>開催開始日<input type="date" name="start_date" defaultValue={entry?.start_date||""}/></label>
 <label>開催終了日<input type="date" name="end_date" defaultValue={entry?.end_date||""}/></label>
 <label className="wide">大会詳細<textarea name="description" rows={7} maxLength={10000} defaultValue={entry?.description}/></label>
 <label className="wide">スケジュール（開催地の現地時間） *<textarea name="schedule" rows={14} maxLength={20000} defaultValue={entry?.schedule} placeholder={"10/10 12:00 メインイベント Day 1A\n10/11 12:00 メインイベント Day 1B\n参加費・開始時刻・会場などを記載できます。"}/></label>
 <label className="wide">公式URL<input type="url" name="official_url" maxLength={2048} defaultValue={entry?.official_url} placeholder="https://"/></label>
 {state.error&&<p className="err" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}{!entry&&" 次の大会を入力できます。"}</p>}
 <div className="wide"><p className="hint">下書きでは未完成の内容も保存できます。公開する前に、日程とスケジュールをご確認ください。</p><Buttons/></div>
 <style jsx>{`
 .tournament-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 24px;padding:26px;align-items:start}
 .tournament-editor label{display:flex;flex-direction:column;gap:8px;min-width:0;font-size:14px;font-weight:600;color:#49351e}
 .wide,.tournament-editor>p{grid-column:1/-1}
 .tournament-editor input:not([type="hidden"]),.tournament-editor select,.tournament-editor textarea{display:block;width:100%;max-width:none;box-sizing:border-box;margin:0;border:1px solid #d9c5a4;border-radius:7px;background:#faf7ef;padding:11px 13px;font:inherit;font-weight:400;color:#382b1e;min-height:44px}
 .tournament-editor textarea{resize:vertical;line-height:1.8;min-height:180px}
 .tournament-editor textarea[name="schedule"]{min-height:320px}
 .tournament-editor input:focus,.tournament-editor select:focus,.tournament-editor textarea:focus{outline:2px solid #cba43c;outline-offset:2px}
 .hint{font-size:12px;line-height:1.7;color:#8a7758;margin:0 0 14px}
 @media(max-width:700px){.tournament-editor{grid-template-columns:minmax(0,1fr);padding:18px;gap:20px}.tournament-editor input:not([type="hidden"]),.tournament-editor select,.tournament-editor textarea{font-size:16px}}
 `}</style>
 </form>;
}

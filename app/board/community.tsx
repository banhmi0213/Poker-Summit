"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/app/avatar";
import { MemberRoleBadge, OfficialBadge } from "@/app/member-role-badge";
import { AcademyBadge } from "@/app/learn/academy-badge";
import { ReportForm } from "@/app/report-form";
import { HANDLE_NAME_MAX } from "@/lib/handle-name";
import { BOARD_REACTIONS, BoardReaction, BoardReply, MentionMember, ThreadPreference, encodeMentions, splitMentions } from "@/lib/board-community";
import { createReply, reportReply } from "./actions";
import { loadBoardChildren, searchMentionMembers, setBoardReaction, setThreadPreference, setThreadResolution } from "./community-actions";
import s from "./community.module.css";

function message(error: unknown) { return error instanceof Error ? error.message : "処理できませんでした。もう一度お試しください。"; }
function useBoardMutation(): [boolean, (task: () => Promise<void>) => void] {
  const [pending,setPending] = useState(false);
  const busy = useRef(false);
  return [pending, task => {
    if (busy.current) return;
    busy.current = true; setPending(true);
    void task().finally(() => { busy.current=false; setPending(false); });
  }];
}
export function BoardBody({ body }: { body: string }) {
  return <div className={s.body}>{splitMentions(body).map((part, i) => part.userId ? <Link className={s.mention} key={i} href={`/members/${part.userId}`}>{part.text}</Link> : <span key={i}>{part.text}</span>)}</div>;
}
export function BoardHelp() {
  return <details className={s.help}><summary>サミットの使い方：メンション・返信・フォローなど</summary><dl>
    <dt>個人メンション</dt><dd>本文で @ に続けて名前を入力し、候補から会員を選んでください。投稿後は青いリンクになり、相手にサイト内通知が届きます。全員宛ての通知はありません。</dd>
    <dt>返信の開閉</dt><dd>「返信する」から相手のコメントへ返信できます。「返信 ○件を表示」で開き、「返信を閉じる」で折りたたみます。返信への返信も、同じ会話の中にまとめます。</dd>
    <dt>リアクション</dt><dd>👍 参考になった／🙏 ありがとう／🔥 ナイスプレイ／🤔 考えたい。各ボタンの数字は反応した人数です。同じボタンをもう一度押すと取り消せます。1人が同じ種類を増やすことはできません。</dd>
    <dt>フォロー</dt><dd>「フォローする」でマイページの「フォロー中」に保存できます。解除しても自分の投稿や返信は消えません。</dd>
    <dt>スレッド通知</dt><dd>フォロー中の新しいコメント、自分のスレッドやコメントへの返信、メンションがマイページの「サミット通知」に届きます。「通知OFF」にすると、そのスレッドの新着通知を受け取りません。フォローと通知は別々に設定できます。メール・プッシュ通知ではありません。</dd>
    <dt>回答済み</dt><dd>スレ主だけが「回答済みにする」を操作できます。役立ったコメントを回答として選ぶこともできます。解除・変更も可能で、回答済みになっても会話は続けられます。</dd>
  </dl><p>相手への配慮を忘れず、困った投稿は通報からお知らせください。非表示になった投稿・返信は通知やフォロー一覧でも表示されません。</p></details>;
}
export function ThreadControls({ postId, preference, resolved, owner, compact = false, followerCount }: { followerCount?: number; postId: string; preference: ThreadPreference; resolved: boolean; owner: boolean; compact?: boolean }) {
  const [current,setCurrent] = useState(preference);
  const [answered,setAnswered] = useState(resolved);
  useEffect(()=>setCurrent(preference),[preference.following,preference.notifications_enabled]);
  useEffect(()=>setAnswered(resolved),[resolved]);
  const [ready,setReady] = useState(false);
  useEffect(()=>setReady(true),[]);
  const [error, setError] = useState(""); const [pending, start] = useBoardMutation();
  function run(task: () => Promise<void>) { setError(""); start(async () => { try { await task(); } catch (e) { setError(message(e)); } }); }
  function changePreference(key:"following"|"notifications_enabled") {
    const previous=current; const next=!current[key];
    setCurrent({...current,[key]:next});
    run(async()=>{try{await setThreadPreference(postId,key,next);}catch(e){setCurrent(previous);throw e;}});
  }
  return <><div className={s.toolbar} data-board-ready={ready}>
    {followerCount !== undefined && <span className={s.hint}>フォロワー {Math.max(0,followerCount + Number(current.following) - Number(preference.following))}人</span>}
    {answered && <span className={s.resolved}>✓ 回答済み</span>}
    <button disabled={pending || !ready} aria-pressed={current.following} onClick={() => changePreference("following")}>{current.following ? "✓ フォロー中・解除" : "＋ フォローする"}</button>
    <button disabled={pending || !ready} aria-pressed={current.notifications_enabled} onClick={() => changePreference("notifications_enabled")}>🔔 通知{current.notifications_enabled ? "ON" : "OFF"}</button>
    {owner && <button disabled={pending || !ready} onClick={() => {setAnswered(!answered);run(async()=>{try{await setThreadResolution(postId,null,!answered);}catch(e){setAnswered(answered);throw e;}});}}>{answered ? "回答済みを解除" : "✓ 回答済みにする"}</button>}
    {!compact && <><Link href="/mypage?tab=boardFollows">フォロー中一覧</Link><Link href="/mypage?tab=boardNotifications">サミット通知</Link></>}
  </div>{!compact && <p className={s.hint}>マイページ内通知ON：メンション・自分宛ての返信を通知。フォローすると新しいコメントも通知されます。</p>}{error && <p role="alert" className={s.error}>{error}</p>}</>;
}
export function ReactionButtons({ postId, replyId = null, rows, userId }: { postId: string; replyId?: string | null; rows: BoardReaction[]; userId: string }) {
  const [choices, setChoices] = useState<Record<string,boolean>>({});
  const [error, setError] = useState(""); const [pending, start] = useBoardMutation();
  return <><div className={s.reactions}>{BOARD_REACTIONS.map(r => {
    const reactions = rows.filter(x => x.reply_id === replyId && x.emoji === r.key);
    const saved = reactions.some(x => x.mine);
    const active = choices[r.key] ?? saved;
    const count = Math.max(0,reactions.reduce((sum,x)=>sum+Number(x.total),0) + Number(active) - Number(saved));
    return <button key={r.key} type="button" className={s.reaction} disabled={pending} aria-pressed={active} aria-label={`${r.label} ${count}人${active ? "、取り消す" : ""}`} title={r.label} onClick={() => { setError(""); start(async () => { try { await setBoardReaction(postId, replyId, r.key, !active); setChoices(prev=>({...prev,[r.key]:!active})); } catch (e) { setError(message(e)); } }); }}><span>{r.emoji}</span><span className={s.reactionLabel}>{r.label}</span><span className={s.count}>{count}</span></button>;
  })}</div>{error && <p role="alert" className={s.error}>{error}</p>}</>;
}
export function MentionInput({ label = "本文", rows = 4, initialMember }: { label?: string; rows?: number; initialMember?: MentionMember }) {
  const [value, setValue] = useState(initialMember ? `@${initialMember.display_name} ` : "");
  const [selected, setSelected] = useState<MentionMember[]>(initialMember ? [initialMember] : []);
  const [query, setQuery] = useState<string | null>(null); const [matches, setMatches] = useState<MentionMember[]>([]);
  const [error, setError] = useState(""); const input = useRef<HTMLTextAreaElement>(null); const caret = useRef(0);
  useEffect(() => {
    if (query === null || !query.trim()) { setMatches([]); return; }
    let live = true;
    const timer = setTimeout(() => { searchMentionMembers(query).then(data => { if (live) { setMatches(data); setError(""); } }).catch(() => { if (live) { setMatches([]); setError("会員候補を取得できませんでした。名前を入力し直してください。"); } }); }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);
  return <><label>{label} *<textarea ref={input} rows={rows} required maxLength={10000} value={value} placeholder="コメントを書く（@名前でメンション）" onChange={e => {
    const v = e.target.value; setValue(v); caret.current = e.target.selectionStart;
    const match = v.slice(0, caret.current).match(/(?:^|\s)@([^@\s]{0,30})$/u); setQuery(match ? match[1] : null);
  }} onKeyDown={e => { if (e.key === "Escape") { setQuery(null); setMatches([]); } }} /></label>
  <input type="hidden" name="body" value={encodeMentions(value, selected)} />
  {matches.length > 0 && <div className={s.candidates} aria-label="メンションする会員を選択">{matches.map(m => <button type="button" key={m.user_id} onClick={() => {
    if (selected.some(x=>x.display_name===m.display_name && x.user_id!==m.user_id)) {
      setError("同じ名前の複数会員へのメンションは、別の投稿に分けてください。選択済みの相手は変更していません。"); return;
    }
    const before = value.slice(0, caret.current); const start = before.lastIndexOf("@");
    const text = `@${m.display_name} `; setValue(value.slice(0, start) + text + value.slice(caret.current));
    setSelected(prev => [...prev.filter(x => x.display_name !== m.display_name), m]); setQuery(null); setMatches([]);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + text.length, start + text.length); });
  }}>@{m.display_name} <span className={s.hint}>会員ID末尾 {m.user_id.slice(-6)}</span></button>)}</div>}
  {error && <p role="status" className={s.hint}>{error}</p>}
  <p className={s.hint}>@の後に名前を入力し、候補を選択するとメンションになります（1投稿10人まで）。</p></>;
}
export function ReplyComposer({ postId, parentId = null, authorName, recipient, onDone }: { postId: string; parentId?: string | null; authorName: string; recipient?: MentionMember; onDone?: () => void }) {
  const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [version, setVersion] = useState(0); const router = useRouter(); const form = useRef<HTMLFormElement>(null);
  return <form ref={form} className={s.composer} action={async fd => {
    setError(""); setPending(true);
    try { await createReply(fd); form.current?.reset(); setVersion(n => n + 1); onDone?.(); router.refresh(); }
    catch (e) { setError(message(e)); } finally { setPending(false); }
  }}><input name="postId" type="hidden" value={postId} /><input name="parentReplyId" type="hidden" value={parentId ?? ""} />
    {authorName ? <p className={s.hint}>投稿者：{authorName}</p> : <label>ハンドルネーム *<input name="authorName" required maxLength={HANDLE_NAME_MAX} autoComplete="nickname" /></label>}
    <MentionInput key={version} label={parentId ? "この会話への返信" : "スレッドへのコメント"} initialMember={recipient} rows={3} />
    <label>画像（任意・1枚）<input type="file" name="image" accept="image/*" /></label>
    <p className={s.hint}>画像は8MBまで。不適切なコメントは運営により非表示になる場合があります。</p>
    <button disabled={pending} type="submit" className="btn primary">{pending ? "送信中…" : "送信する"}</button>
    {error && <p className={s.error} role="alert">{error}</p>}
  </form>;
}
type Author = { avatar?: string | null; role?: string | null; official?: boolean; score?: number };
export function ReplyConversation({ reply, postId, userId, authorName, owner, resolutionId, resolved, reactions, authors, childCount, focusReplyId }: {
  reply: BoardReply; postId: string; userId: string; authorName: string; owner: boolean; resolutionId: string | null; resolved: boolean; reactions: BoardReaction[]; authors: Record<string, Author>; childCount: number; focusReplyId?: string;
}) {
  const [childReactions, setChildReactions] = useState<BoardReaction[]>([]);
  const [childAuthors,setChildAuthors] = useState<Record<string,Author>>({});
  const [open, setOpen] = useState(Boolean(focusReplyId)); const [children, setChildren] = useState<BoardReply[]>([]); const [total, setTotal] = useState(childCount);
  const [page, setPage] = useState(0); const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<BoardReply | null>(null); const [error, setError] = useState(""); const [pending, start] = useBoardMutation();
  async function load(p: number, append: boolean) {
    setLoading(true); setError("");
    try { const result = await loadBoardChildren(postId, reply.id, p); setChildren(prev => append ? [...prev, ...result.replies] : result.replies); setChildReactions(prev => append ? [...prev.filter(x=>x.reply_id!==null), ...result.reactions.filter((x:BoardReaction)=>x.reply_id!==null)] : result.reactions.filter((x:BoardReaction)=>x.reply_id!==null)); setChildAuthors(prev=>({...prev,...result.authors})); setTotal(result.total); setPage(p + 1); setLoaded(true); }
    catch (e) { setError(message(e)); } finally { setLoading(false); }
  }
  useEffect(() => { if (focusReplyId) setOpen(true); }, [focusReplyId]);
  useEffect(() => { if (open && !loaded && !loading) void load(0, false); }, [open, loaded]); // load only on first expansion
  useEffect(() => { setTotal(childCount); if (loaded) { if (open) void load(0, false); else { setLoaded(false); setChildren([]); } } }, [childCount]);
  // A notification can target a child on a later page; fetch through it before scrolling.
  useEffect(() => { if (!focusReplyId || !loaded || loading || error) return;
    if (focusReplyId === reply.id || children.some(c => c.id === focusReplyId)) document.getElementById(`reply-${focusReplyId}`)?.scrollIntoView({ block: "center" });
    else if (children.length < total) void load(page, true);
  }, [focusReplyId, loaded, loading, children.length, total]);
  function card(r: BoardReply, root: boolean) {
    const a = r.author_user_id ? (authors[r.author_user_id] ?? childAuthors[r.author_user_id]) : {};
    return <div className={root ? s.comment : s.child} id={`reply-${r.id}`} key={r.id}>
      <div className={s.commentHead}><div className={s.author}>
        {r.author_user_id ? <Link href={`/members/${r.author_user_id}`}><Avatar name={r.author_name} url={a?.avatar} /></Link> : <Avatar name={r.author_name} />}
        <div><OfficialBadge show={a?.official ?? false} /><MemberRoleBadge role={a?.role} /><AcademyBadge score={a?.score} compact /><div className={s.authorName}>{r.author_name} {resolutionId === r.id && <span className={s.resolved}>✓ スレ主が選んだ回答</span>}</div><div className={s.date}>{new Date(r.created_at).toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})}</div></div>
      </div><ReportForm kind="reply" label="🚩" action={reportReply.bind(null, r.id, postId)} buttonStyle={{ fontSize: 11 }} /></div>
      <BoardBody body={r.body} />{r.image_url && <img src={r.image_url} alt="コメントに添付された画像" loading="lazy" className={s.image} />}
      <ReactionButtons postId={postId} replyId={r.id} rows={root ? reactions : childReactions} userId={userId} />
      <div className={s.toolbar}><button className={s.replyButton} onClick={() => { setReplyTo(replyTo?.id === r.id ? null : r); }}>↩ {replyTo?.id === r.id ? "返信入力を閉じる" : "返信する"}</button>
      {owner && (!resolved || resolutionId === r.id) && <button disabled={pending} onClick={() => { setError(""); start(async () => { try { await setThreadResolution(postId, r.id, resolutionId !== r.id); } catch (e) { setError(message(e)); } }); }}>{resolutionId === r.id ? "回答の選択を解除" : "✓ この回答で回答済みにする"}</button>}</div>
      {replyTo?.id === r.id && <ReplyComposer key={r.id} postId={postId} parentId={reply.id} authorName={authorName} recipient={r.author_user_id ? { user_id: r.author_user_id, display_name: r.author_name } : undefined} onDone={() => { setReplyTo(null); setOpen(true); void load(0, false); }} />}
    </div>;
  }
  return <section className="card">{card(reply, true)}{(total > 0 || childCount > 0) && <button className={s.replyButton} aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? "▾ 返信を閉じる" : `▸ 返信 ${total}件を表示`}</button>}
    {open && <div className={s.children}>{children.map(r => card(r, false))}{loading && <p role="status" className={s.hint}>返信を読み込み中…</p>}{!loading && children.length < total && <button className={s.more} onClick={() => void load(page, true)}>さらに返信を表示（残り {total - children.length}件）</button>}</div>}
    {error && <p className={s.error} role="alert">{error}</p>}
  </section>;
}

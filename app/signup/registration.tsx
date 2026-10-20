import { PasswordInput } from "@/app/password-input";
import Link from "next/link";
import { SignupSubmitButton } from "./submit-button";
import { signUp, prelaunchSignUp } from "./actions";
import styles from "./signup.module.css";
import { M_HOLDEM_ID_MAX_LENGTH, M_HOLDEM_PARTICIPATION_NOTICE } from "@/lib/m-holdem";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { PASSWORD_INPUT_PATTERN, PASSWORD_MIN_LENGTH, PASSWORD_RULE_LABEL } from "@/lib/password-policy";
import Script from "next/script";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { PRELAUNCH_TOURNAMENT, PRELAUNCH_LAUNCH_LABEL, PRELAUNCH_FEATURES } from "@/lib/prelaunch";
import { SignupFunnelTracker } from "./funnel-tracker";

export function RegistrationPage({ searchParams, early = false, memberPreview = false }: { searchParams: { error?: string; done?: string }; early?: boolean; memberPreview?: boolean }) {
  const params = searchParams;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Poker Summit トップページ"><img className={styles.logo} src="/images/logo.webp" alt="Poker Summit" /></Link>
        <span className={styles.headerLabel}>{early ? "先行会員登録受付中" : "無料会員登録"}</span>
        {!early && <Link href="/" className={styles.back}>← トップに戻る</Link>}
      </header>
      <div className={styles.layout + (early ? " " + styles.earlyLayout : "")}>
        <section className={styles.intro + (early ? " " + styles.earlyIntro : "")}>
          <span className={styles.eyebrow}>{early ? "PRE-REGISTRATION" : "MEMBER REGISTRATION"}</span>
          <h1><span>ポーカーの楽しさが</span><br /><span>ここに集まる。</span></h1>
          {early ? (
            // 正式オープン日と、会員になると使えること(2026/10/19)。以前の説明文と入れ替え
            <>
              <p className={styles.launchBadge}>{PRELAUNCH_LAUNCH_LABEL}</p>
              <p className={styles.lead}>{memberPreview ? "登録するとオープン前のサイトを先行で見られます。" : "先行登録しておくと、オープン当日からすぐに使えます。"}</p>
              <ul className={styles.featureList}>
                {PRELAUNCH_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.lead}>お気に入り店舗の保存・求人応募・クーポン利用など、<br className={styles.desktopBreak} />会員限定の便利な機能が使えます。</p>
          )}
          {early && <aside className={styles.tournamentPromo} aria-labelledby="early-tournament-title">
            <h2 id="early-tournament-title"><img src="/images/summit-finger-clean.webp" alt="" width={34} height={40} /><span className={styles.tournamentTitle}>先行会員限定<wbr />トーナメント<wbr />開催決定！</span></h2>
            <p>先行登録いただいた方を、m HOLD’EMアプリで開催する限定トーナメントにご招待します。</p>
            <p className={styles.tournamentNote}>※参加にはダイヤ20個が必要です（アプリのログインボーナスなどで無料でも受け取れます）。<br />※本大会はPoker Summit主催です（サミー株式会社・m HOLD’EMの公認・協賛大会ではありません）。</p>
            <dl className={styles.tournamentFacts}>
              <div><dt>開催日時</dt><dd>{PRELAUNCH_TOURNAMENT.dateLabel}</dd></div>
              <div><dt>プライズ</dt><dd>{PRELAUNCH_TOURNAMENT.prizeLabel}</dd></div>
            </dl>
            {/* スマホでは最初の画面にフォームが入らないので、主役のボタンは登録フォームへ(2026/10/19)。公式Xは控えめなリンクに */}
            <a className={styles.xFollowButton + " " + styles.jumpToForm} href="#signup-form">無料で先行登録する</a>
            <p className={styles.tournamentXLink}>参加方法・最新情報は<a href="https://x.com/poker_summit" target="_blank" rel="noopener noreferrer">公式X</a>でお知らせします</p>
          </aside>}
          <img className={styles.photo} src="/images/member-registration-approved-photo.webp" alt="Poker Summitのロゴが入ったテーブルでカードを配るディーラー" width={668} height={525} />
        </section>
        <section className={styles.panel} id="signup-form" aria-label="会員登録フォーム">
      {params.done ? (
        <div className={styles.success}>
          <h2 className={styles.heading}>
            確認メールをお送りしました
          </h2>
          <p className="muted">
            ご入力いただいたメールアドレスに確認メールを送りました。メール内のリンクを押すと登録が完了し、そのままログインした状態になります。
          </p>
          <ul className="muted" style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
            <li>リンクの有効期限は24時間です。</li>
            <li>届かない場合は、迷惑メールフォルダもご確認ください（送信元：noreply@pokersummit.jp）。</li>
            <li>期限が切れた場合や見つからない場合は、登録したメールアドレスとパスワードでログインすると確認メールが届き直します。</li>
          </ul>
          <Link href="/login" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
            ログインへ
          </Link>
        </div>
      ) : (
        <div>
          <h2 className={styles.heading}>{early ? "無料で先行登録" : "無料会員登録"}</h2>
          <p className={styles.badge}>無料・年会費なし</p>
          {params.error && <p className={styles.error} role="alert">{params.error}</p>}
          <form action={early ? prelaunchSignUp : signUp} id="registration-form">
            {early && <SignupFunnelTracker formId="registration-form" />}
            <label className={styles.field}>
              <span>ハンドルネーム <b className={styles.optional}>任意</b></span>
              <input type="text" name="name" autoComplete="nickname" placeholder="例）ポーカー太郎" />
            </label>
            {/* 都道府県は登録画面では聞かない(2026/10/20、入力を減らすため)。あとからマイページで入れられる。
                集計用に、登録したときのだいたいの都道府県をサーバー側で記録する(signup/actions.ts) */}
            <label className={styles.field}>
              <span>メールアドレス <b className={styles.required}>必須</b></span>
              {early && <small>※確認メールと、限定トーナメントの参加方法・オープンのお知らせにのみ使います。公開されることはありません。</small>}
              <input type="email" name="email" required autoComplete="email" placeholder="例）example@example.com" />
            </label>
            <label className={styles.field}>
              <span>パスワード <b className={styles.required}>必須</b></span>
              <small>{PASSWORD_RULE_LABEL}</small>
              <PasswordInput
                name="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                pattern={PASSWORD_INPUT_PATTERN}
                title={PASSWORD_RULE_LABEL}
                autoComplete="new-password"
              />
            </label>
            <label className={styles.field}>
              <span>m HOLD’EM ID <b className={styles.optional}>任意</b></span>
              <input type="text" name="mHoldemId" autoCapitalize="none" autoCorrect="off" maxLength={M_HOLDEM_ID_MAX_LENGTH} autoComplete="off" spellCheck={false} placeholder="IDを入力" aria-describedby="m-holdem-notice" />
            </label>
            <div id="m-holdem-notice" className={styles.notice}>
              <strong>{M_HOLDEM_PARTICIPATION_NOTICE}</strong>
              <p>未入力でも会員登録できます（あとからマイページで登録できます）。IDは一般公開されません。<strong>一度登録すると変更できませんので、お間違えのないようご入力ください。</strong></p>
            </div>
            <input type="hidden" name="termsVersion" value={TERMS_VERSION} />
            <input type="hidden" name="privacyVersion" value={PRIVACY_VERSION} />
            <label className={styles.consent}>
              <input type="checkbox" name="legalConsent" value="agree" required style={{ marginTop: 5, flexShrink: 0 }} />
              <span><Link href="/terms" target="_blank" rel="noopener noreferrer">利用規約</Link>および<Link href="/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>を確認し、同意します。</span>
            </label>
            {TURNSTILE_SITE_KEY && (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
                <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language="ja" data-size="flexible" style={{ margin: "0 0 14px" }} />
              </>
            )}
            <SignupSubmitButton className={styles.submit} label={early ? "先行会員登録する" : "無料会員登録する"} />
          </form>
          <p className={styles.confirmation}>登録後、確認メールをお送りします。{early && "都道府県の公開・非公開はマイページで変更できます。"}</p>
          <p className={styles.help}>
            すでにアカウントをお持ちの方は<Link href="/login">こちらからログイン</Link>
          </p>
        </div>
      )}
        </section>
      </div>
      <footer className={styles.footer}><nav><Link href="/terms">利用規約</Link><Link href="/privacy">プライバシーポリシー</Link><Link href="/contact">お問い合わせ</Link></nav>{early && <p className={styles.storeLinks}>ポーカー店のオーナー様・運営者様へ：<Link href="/apply">掲載のお申込み</Link>／<Link href="/store/login">店舗管理ログイン</Link></p>}© Poker Summit</footer>
    </main>
  );
}

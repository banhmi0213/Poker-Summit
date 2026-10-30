// スクレイピング（自動収集）の見張り（オーナー指示 2026/10/30：スクレイピングされたら速攻わかるように。遮断はせず、記録して知らせる）。
// middleware から呼ぶので、サーバー専用の物は読み込まない（Edge で動く）。
/** AI の学習用に集める収集ロボット。robots.txt で全ページ禁止にしている（app/robots.ts）。 */
export const AI_CRAWLERS = [
  "GPTBot", "ClaudeBot", "Claude-Web", "anthropic-ai",
  "Google-Extended", "GoogleOther", "Applebot-Extended", "CCBot", "Bytespider", "Amazonbot",
  "meta-externalagent", "meta-externalfetcher", "FacebookBot", "cohere-ai", "cohere-training-data-crawler", "Diffbot", "Omgilibot",
  "YouBot", "AI2Bot", "Ai2Bot-Dolma", "ImagesiftBot", "Timpibot", "Kangaroo Bot", "PanguBot", "Webzio-Extended",
];
/** ChatGPT などで検索されたときに、このサイトを結果に出すためのロボット（オーナー 2026/10/31：GPTで探したりもするよな）。
 * Google と同じ扱い：公開ページは見てよく、記録もしない。 */
export const AI_SEARCH_BOTS = [
  "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "DuckAssistBot", "MistralAI-User",
];
/** 検索エンジン・SNSのリンクプレビューなど、普通の巡回（記録しない）。 */
const ALLOWED = [/googlebot/i, /adsbot-google/i, /mediapartners-google/i, /google-inspectiontool/i, /bingbot/i, /msnbot/i, /\bapplebot\b(?!-extended)/i, /duckduckbot/i, /yandex/i, /baiduspider/i,
  /twitterbot/i, /facebookexternalhit/i, /slackbot/i, /discordbot/i, /telegrambot/i, /whatsapp/i, /linkedinbot/i, /line-poker|linebot/i, /vercel/i, /uptimerobot/i, /lighthouse/i];
/** プログラム・ツールからのアクセス。 */
const TOOLS: [RegExp, string][] = [[/curl\//i, "curl"], [/wget/i, "wget"], [/python-requests/i, "python-requests"], [/python-urllib/i, "python-urllib"], [/aiohttp/i, "aiohttp"], [/python-httpx|\bhttpx\b/i, "httpx"],
  [/go-http-client/i, "Go"], [/^java\//i, "Java"], [/okhttp/i, "okhttp"], [/apache-httpclient/i, "Apache-HttpClient"], [/libwww-perl/i, "perl"], [/scrapy/i, "Scrapy"], [/node-fetch/i, "node-fetch"],
  [/axios\//i, "axios"], [/undici/i, "undici"], [/postmanruntime/i, "Postman"], [/httrack/i, "HTTrack"], [/colly/i, "colly"], [/nutch/i, "Nutch"], [/heritrix/i, "Heritrix"], [/guzzlehttp/i, "Guzzle"],
  [/mechanize/i, "mechanize"], [/^ruby/i, "Ruby"], [/^php\//i, "PHP"]];
const HEADLESS: [RegExp, string][] = [[/headlesschrome/i, "HeadlessChrome"], [/phantomjs/i, "PhantomJS"], [/puppeteer/i, "Puppeteer"], [/playwright/i, "Playwright"], [/selenium/i, "Selenium"]];

export type ScrapeCategory = "ai" | "tool" | "headless" | "no-ua" | "no-browser";
export const SCRAPE_CATEGORY_LABEL: Record<ScrapeCategory, string> = {
  ai: "AIの収集ロボット", tool: "プログラム・ツール", headless: "自動操作のブラウザ", "no-ua": "名乗らないアクセス", "no-browser": "ブラウザらしくないアクセス",
};

/** 疑わしいアクセスなら種類と名前、普通のアクセスなら null。 */
export function classifyScrape(userAgent: string | null, headers: { acceptLanguage: string | null; secFetchSite: string | null }): { category: ScrapeCategory; bot: string } | null {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { category: "no-ua", bot: "(なし)" };
  const lower = ua.toLowerCase();
  if (AI_SEARCH_BOTS.some((name) => lower.includes(name.toLowerCase()))) return null;
  const ai = AI_CRAWLERS.find((name) => lower.includes(name.toLowerCase()));
  if (ai) return { category: "ai", bot: ai };
  if (ALLOWED.some((re) => re.test(ua))) return null;
  for (const [re, name] of TOOLS) if (re.test(ua)) return { category: "tool", bot: name };
  for (const [re, name] of HEADLESS) if (re.test(ua)) return { category: "headless", bot: name };
  // 普通のブラウザは言語の設定と sec-fetch-* を必ず送る。どちらも無いものは自動のことが多い（大量のときだけ知らせる）。
  if (!headers.acceptLanguage && !headers.secFetchSite) return { category: "no-browser", bot: ua.slice(0, 60) };
  return null;
}

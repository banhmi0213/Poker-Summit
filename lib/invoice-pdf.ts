// 銀行振込の請求書PDF(適格請求書=インボイス対応)。
// 記載事項: 発行者の名称・登録番号 / 取引年月日(対象期間) / 取引内容 /
// 税率ごとの合計額と税率 / 税率ごとの消費税額 / 宛名。
// フォントは assets/fonts の BIZ UDPゴシック(SIL Open Font License)を埋め込む。

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  ISSUER,
  addDays,
  addMonths,
  cycleLabel,
  formatJpDate,
  isoToJstDate,
  type BillingSettings,
  type InvoiceRow,
} from "@/lib/bank-transfer";

let fontCache: Promise<[Uint8Array, Uint8Array]> | null = null;

function loadFonts() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    fontCache = Promise.all([
      readFile(path.join(dir, "BIZUDPGothic-Regular.ttf")),
      readFile(path.join(dir, "BIZUDPGothic-Bold.ttf")),
    ]).then(([r, b]) => [new Uint8Array(r), new Uint8Array(b)] as [Uint8Array, Uint8Array]);
    fontCache.catch(() => {
      fontCache = null;
    });
  }
  return fontCache;
}

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

const INK = rgb(0.13, 0.13, 0.16);
const MUTED = rgb(0.42, 0.42, 0.47);
const LINE = rgb(0.78, 0.78, 0.82);
const HEAD_BG = rgb(0.93, 0.94, 0.96);
const ACCENT = rgb(0.72, 0.53, 0.04);

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont };

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {}
) {
  const font = opts.bold ? ctx.bold : ctx.regular;
  const size = opts.size ?? 10;
  const width = font.widthOfTextAtSize(value, size);
  const dx = opts.align === "right" ? -width : opts.align === "center" ? -width / 2 : 0;
  ctx.page.drawText(value, { x: x + dx, y, size, font, color: opts.color ?? INK });
  return width;
}

function hline(ctx: Ctx, x1: number, x2: number, y: number, thickness = 0.6, color = LINE) {
  ctx.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

export function invoicePeriodLabel(invoice: Pick<InvoiceRow, "period_start" | "period_end" | "months">) {
  if (invoice.period_start) {
    const end = invoice.period_end ?? addDays(addMonths(invoice.period_start, invoice.months), -1);
    return `${formatJpDate(invoice.period_start)}〜${formatJpDate(end)}`;
  }
  return `ご入金確認日から${invoice.months}か月間`;
}

export async function buildInvoicePdf(invoice: InvoiceRow, settings: BillingSettings): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  doc.setTitle(`請求書 ${invoice.invoice_number}`);
  doc.setAuthor(ISSUER.name);
  doc.setCreator("Poker Summit");

  const page = doc.addPage([595.28, 841.89]); // A4
  const ctx: Ctx = { page, regular, bold };
  const L = 50;
  const R = 545;
  let y = 790;

  // タイトル
  text(ctx, "請 求 書", (L + R) / 2, y, { size: 22, bold: true, align: "center" });
  y -= 14;
  hline(ctx, L, R, y, 1.2, ACCENT);

  // 番号・発行日(右上)
  y -= 22;
  const issued = isoToJstDate(invoice.issued_at);
  text(ctx, `請求書番号　${invoice.invoice_number}`, R, y, { size: 9, align: "right", color: MUTED });
  text(ctx, `発行日　${formatJpDate(issued)}`, R, y - 14, { size: 9, align: "right", color: MUTED });

  // 宛名(左)
  const nameY = y - 10;
  text(ctx, `${invoice.bill_to_name}　御中`, L, nameY, { size: 15, bold: true });
  hline(ctx, L, L + 260, nameY - 6, 0.8, INK);
  if (invoice.bill_to_contact) {
    text(ctx, `ご担当：${invoice.bill_to_contact} 様`, L, nameY - 22, { size: 9.5, color: MUTED });
  }

  // 発行者(右)
  let iy = nameY - 30;
  const IX = 345;
  text(ctx, ISSUER.name, IX, iy, { size: 11.5, bold: true });
  iy -= 15;
  text(ctx, ISSUER.address, IX, iy, { size: 8 });
  iy -= 12;
  text(ctx, `TEL ${ISSUER.tel}`, IX, iy, { size: 8 });
  iy -= 12;
  text(ctx, ISSUER.email, IX, iy, { size: 8 });
  iy -= 12;
  if (settings.registrationNumber) {
    text(ctx, `登録番号　${settings.registrationNumber}`, IX, iy, { size: 8.5, bold: true });
    iy -= 12;
  }

  // ご請求金額
  y = Math.min(iy, nameY - 40) - 18;
  text(ctx, "下記のとおりご請求申し上げます。", L, y, { size: 10 });
  y -= 30;
  page.drawRectangle({ x: L, y: y - 10, width: 300, height: 34, color: HEAD_BG });
  text(ctx, "ご請求金額（税込）", L + 12, y + 2, { size: 10, bold: true });
  text(ctx, yen(invoice.total_amount), L + 288, y, { size: 18, bold: true, align: "right" });
  text(ctx, "お支払期限", 370, y + 9, { size: 9, color: MUTED });
  text(ctx, formatJpDate(invoice.due_date), 370, y - 6, { size: 12, bold: true });

  // 明細
  y -= 42;
  const cols = { item: L + 8, qty: 365, unit: 450, amount: R - 8 };
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 22, color: HEAD_BG });
  text(ctx, "品目", cols.item, y, { size: 9.5, bold: true });
  text(ctx, "数量", cols.qty, y, { size: 9.5, bold: true, align: "right" });
  text(ctx, "単価（税込）", cols.unit, y, { size: 9.5, bold: true, align: "right" });
  text(ctx, "金額（税込）", cols.amount, y, { size: 9.5, bold: true, align: "right" });
  y -= 26;

  const rows: Array<{ item: string; sub?: string; qty: string; unit: string; amount: string }> = [
    {
      item: `Poker Summit 店舗掲載料　${invoice.plan_name}`,
      sub: `対象期間：${invoicePeriodLabel(invoice)}（${cycleLabel(invoice.months)}）`,
      qty: `${invoice.months}か月`,
      unit: yen(invoice.monthly_fee),
      amount: yen(invoice.monthly_fee * invoice.months),
    },
  ];
  if (invoice.discount_amount > 0) {
    rows.push({
      item: `まとめ払い割引${invoice.discount_label ? `（${invoice.discount_label}）` : ""}`,
      qty: "1",
      unit: `-${yen(invoice.discount_amount)}`,
      amount: `-${yen(invoice.discount_amount)}`,
    });
  }
  for (const row of rows) {
    text(ctx, row.item, cols.item, y, { size: 9.5 });
    text(ctx, row.qty, cols.qty, y, { size: 9.5, align: "right" });
    text(ctx, row.unit, cols.unit, y, { size: 9.5, align: "right" });
    text(ctx, row.amount, cols.amount, y, { size: 9.5, align: "right" });
    if (row.sub) {
      y -= 13;
      text(ctx, row.sub, cols.item + 6, y, { size: 8, color: MUTED });
    }
    y -= 10;
    hline(ctx, L, R, y);
    y -= 16;
  }

  // 合計(税率ごと)
  const TX = 330;
  const totals: Array<[string, string, boolean]> = [
    ["10%対象（税込）", yen(invoice.total_amount), false],
    ["うち消費税（10%）", yen(invoice.tax_amount), false],
    ["合計（税込）", yen(invoice.total_amount), true],
  ];
  for (const [label, value, strong] of totals) {
    text(ctx, label, TX, y, { size: strong ? 10.5 : 9.5, bold: strong });
    text(ctx, value, cols.amount, y, { size: strong ? 11 : 9.5, bold: strong, align: "right" });
    y -= 6;
    hline(ctx, TX, R, y, strong ? 1 : 0.6, strong ? INK : LINE);
    y -= 16;
  }

  // お振込先
  y -= 10;
  text(ctx, "お振込先", L, y, { size: 10.5, bold: true });
  y -= 8;
  hline(ctx, L, R, y, 0.8, INK);
  y -= 18;
  const bank = settings.bank;
  if (bank) {
    const bankRows: Array<[string, string]> = [
      ["金融機関", bank.bank],
      ["支店", bank.branch],
      ["口座", `${bank.type}　${bank.number}`],
      ["口座名義", bank.holder],
    ];
    for (const [label, value] of bankRows) {
      text(ctx, label, L + 8, y, { size: 9.5, color: MUTED });
      text(ctx, value, L + 90, y, { size: 10.5, bold: true });
      y -= 17;
    }
  } else {
    text(ctx, "振込先は別途ご案内いたします。", L + 8, y, { size: 9.5 });
    y -= 17;
  }

  // 備考
  y -= 10;
  text(ctx, "備考", L, y, { size: 10.5, bold: true });
  y -= 8;
  hline(ctx, L, R, y, 0.8, INK);
  y -= 16;
  const notes = [
    `・お支払期限（${formatJpDate(invoice.due_date)}）までに上記口座へお振り込みください。`,
    "・振込手数料はお客様のご負担にてお願いいたします。",
    "・ご依頼人名はお申し込み時の店舗名・会社名でお願いいたします。",
    `　名義が異なる場合は、お手数ですが ${ISSUER.email} までご連絡ください。`,
    "・お支払期限までにご入金が確認できない場合、店舗ページの公開を停止いたします。",
    "　ご入金の確認後、公開を再開いたします。",
  ];
  for (const line of notes) {
    text(ctx, line, L + 4, y, { size: 8.8 });
    y -= 14;
  }

  if (invoice.status === "paid" && invoice.paid_at) {
    y -= 6;
    text(ctx, `ご入金確認日：${formatJpDate(isoToJstDate(invoice.paid_at))}（お支払い済み）`, L + 4, y, {
      size: 9.5,
      bold: true,
      color: ACCENT,
    });
  }

  // フッター
  text(ctx, `${ISSUER.service}　運営：${ISSUER.name}`, (L + R) / 2, 40, { size: 7.5, align: "center", color: MUTED });

  return doc.save();
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStoreClient } from "@/lib/supabase/store-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getBillingSettings, type InvoiceRow } from "@/lib/bank-transfer";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 請求書PDFのダウンロード。運営(総合管理)か、その請求書の店舗のオーナー(店舗管理)だけ。
async function canView(invoice: InvoiceRow) {
  try {
    const admin = await createClient();
    const {
      data: { user },
    } = await admin.auth.getUser();
    if (user) {
      const { data: row } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (row) return true;
    }
  } catch {
    // 運営セッションなし
  }
  if (!invoice.store_id) return false;
  try {
    const store = await createStoreClient();
    const {
      data: { user },
    } = await store.auth.getUser();
    if (!user) return false;
    const { data: owned } = await store
      .from("stores")
      .select("id")
      .eq("id", invoice.store_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    return !!owned;
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const svc = createServiceRoleClient();
  const { data: invoice } = await svc.from("invoices").select("*").eq("id", params.id).maybeSingle();
  if (!invoice || !(await canView(invoice as InvoiceRow))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const pdf = await buildInvoicePdf(invoice as InvoiceRow, await getBillingSettings(svc));
  const filename = `請求書_${(invoice as InvoiceRow).invoice_number}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

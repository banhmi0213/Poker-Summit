import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

// フッターの「免責事項」リンク先(2026/10/01追加)。本文は後日差し替え予定
// ("中身は明日渡す"との指示)。
export default function DisclaimerPage() {
  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>免責事項</h1>
        <div className="card">
          <p className="muted">ただいま準備中です。近日中に掲載いたします。</p>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

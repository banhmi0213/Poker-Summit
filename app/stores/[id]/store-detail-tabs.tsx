"use client";

import { useRef, useState, type ReactNode } from "react";

type Panel = { id: string; label: string; content: ReactNode };

export function StoreDetailTabs({ panels }: { panels: Panel[] }) {
  const [active, setActive] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="sd-tabbed-content">
      <div className="sd-tabs" role="tablist" aria-label="店舗情報の各項目">
        <div className={active === null ? "sd-content-grid sd-tab-overview" : "sd-tab-selected"}>
        {[0, 1].map((column) => (
          <div key={column}
            className={active === null ? (column === 0 ? "sd-content-main" : "sd-content-side") : ""}
            hidden={active !== null && (column === 0 ? active >= 2 : active < 2)}>
            {panels.map((panel, index) => {
              if ((column === 0) !== (index < 2)) return null;
              return (
                <div key={panel.id} role="tabpanel" id={"panel-" + panel.id}
                  aria-labelledby={"tab-" + panel.id} hidden={active !== null && active !== index}
                  className="sd-tab-panel" tabIndex={0}>
                  {panel.content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

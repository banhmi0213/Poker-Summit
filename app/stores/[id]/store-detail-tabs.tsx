"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { DetailIcon } from "./detail-icon";
import { StoreDetailViewContext } from "./detail-tab-link";

type Panel = { id: string; label: string; content: ReactNode };

export function StoreDetailTabs({ panels, schedule }: { panels: Panel[]; schedule?: ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const show = (event: Event) => {const index = panels.findIndex(panel => panel.id === (event as CustomEvent).detail); if(index >= 0) {setActive(index); buttons.current[index]?.focus({preventScroll:true});}};
    window.addEventListener("store-detail-tab",show); return () => window.removeEventListener("store-detail-tab",show);
  }, [panels]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <StoreDetailViewContext.Provider value={active !== null}>
    <div className="sd-tabbed-content">
      <div className="sd-tabs" role="tablist" aria-label="店舗情報の各項目">
        {panels.map((panel, index) => (
          <button key={panel.id} type="button" role="tab"
            id={"tab-" + panel.id} aria-controls={"panel-" + panel.id}
            aria-selected={active === index || (active === null && index === 0)}
            tabIndex={active === index || (active === null && index === 0) ? 0 : -1}
            ref={(element) => { buttons.current[index] = element; }}
            onClick={() => setActive(index === 0 ? null : index)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % panels.length;
              else if (event.key === "ArrowLeft") next = (index + panels.length - 1) % panels.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = panels.length - 1;
              else return;
              event.preventDefault();
              setActive(next);
              buttons.current[next]?.focus({ preventScroll: true });
            }}>
            <DetailIcon name={(["menu", "calendar", "ticket", "notice", "briefcase"] as const)[index]} />{panel.label}
          </button>
        ))}
      </div>
      {active !== null && <div style={{ display: "flex", justifyContent: "flex-end", margin: "12px 0 0" }}>
        <button type="button" className="sd-see-all" onClick={() => { setActive(null); buttons.current[0]?.focus({ preventScroll: true }); }}>‹ 戻る</button>
      </div>}
      <div className={active === null ? "sd-content-grid sd-tab-overview" : "sd-tab-selected"}>
        {[0, 1].map((column) => (
          <div key={column}
            className={active === null ? (column === 0 ? "sd-content-main" : "sd-content-side") : ""}
            hidden={active !== null && (column === 0 ? active >= 2 : active < 2)}>
            {panels.map((panel, index) => {
              if (index === 4 || (column === 0) !== (index < 2)) return null;
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
        <div className={active === null ? "sd-bottom-row" : "sd-job-selected"} hidden={active !== null && active !== 4}>
          {active === null && schedule}
          <div role="tabpanel" id="panel-jobs" aria-labelledby="tab-jobs" className="sd-job-panel">{panels[4]?.content}</div>
        </div>
      </div>
    </div>
    </StoreDetailViewContext.Provider>
  );
}

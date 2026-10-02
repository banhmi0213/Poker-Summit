"use client";

import { useRef, useState, type ReactNode } from "react";

type Panel = { id: string; label: string; content: ReactNode };

export function StoreDetailTabs({ panels }: { panels: Panel[] }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="sd-tabbed-content">
      <div className="sd-tabs" role="tablist" aria-label="店舗情報の各項目">
        {panels.map((panel, index) => (
          <button key={panel.id} type="button" role="tab"
            id={"tab-" + panel.id} aria-controls={"panel-" + panel.id}
            aria-selected={active === index} tabIndex={active === index ? 0 : -1}
            ref={(element) => { buttons.current[index] = element; }}
            onClick={() => setActive(index)}
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
            {panel.label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div key={panel.id} role="tabpanel" id={"panel-" + panel.id}
          aria-labelledby={"tab-" + panel.id} hidden={active !== index}
          className="sd-tab-panel" tabIndex={0}>
          {panel.content}
        </div>
      ))}
    </div>
  );
}

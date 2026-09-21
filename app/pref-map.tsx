"use client";

import { useState } from "react";
import Link from "next/link";
import { PREF_GRID, shortPref, buildStoreListHref } from "@/lib/pref-grid";

/**
 * Tapping a prefecture only needs to show a count that we already have
 * (prefCounts is computed once on the server and passed down whole), so this
 * is a client component with local state: no navigation, no server round
 * trip, just an instant UI update — matching the prototype's behavior.
 * The only real navigation is the explicit "店舗を見る" button, which jumps
 * to the (server-filtered) store list below.
 */
export function PrefMap({
  prefCounts,
  q,
  category,
  initialPref,
}: {
  prefCounts: Record<string, number>;
  q: string;
  category: string;
  initialPref: string;
}) {
  const [pref, setPref] = useState(initialPref);

  return (
    <div className="map-panel" style={{ marginBottom: 12 }}>
      <div className="map-bg-shade" />
      <div className="map-overlay-bar">
        {pref ? (
          <>
            <div>
              <span className="name">
                {pref}
                <span className="count">{prefCounts[pref] ?? 0}店舗</span>
              </span>
            </div>
            <Link href={buildStoreListHref(q, category, pref)} className="btn primary" style={{ fontSize: 12 }}>
              店舗を見る →
            </Link>
          </>
        ) : (
          <span className="hint">気になる都道府県をタップしてください</span>
        )}
      </div>
      <div className="jp-grid">
        {PREF_GRID.map(([name, col, row, cs, rs]) => {
          const count = prefCounts[name] ?? 0;
          const isSelected = name === pref;
          const cls = isSelected ? "jp-tile selected" : count > 0 ? "jp-tile has-data" : "jp-tile";
          return (
            <button
              key={name}
              type="button"
              onClick={() => setPref(isSelected ? "" : name)}
              className={cls}
              style={{
                gridColumn: `${col + 1} / span ${cs ?? 1}`,
                gridRow: `${row + 1} / span ${rs ?? 1}`,
              }}
            >
              {shortPref(name)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
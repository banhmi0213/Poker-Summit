// Identical StatTile markup/styles from analytics/page.tsx; the existing page stays untouched.
export function StatTile({ label, value, delta }: { label: string; value: string; delta?: import("react").ReactNode }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 12.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }} className="tabular">
        {value}
      </div>
      {delta && <div className="muted" style={{ fontSize: 12 }}>{delta}</div>}
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchYtdMonthlyRevenue } from "../api/reports";
import { formatMoney } from "../utils/money";

type Row = { month: number; label: string; amount: number };

export default function RevenueReportPage() {
  const [params] = useSearchParams();
  const view = params.get("view") || "ytd";

  const [rows, setRows] = useState<Row[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Optional chart toggle (simple)
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (view !== "ytd") {
          // v1 only supports ytd for now
          throw new Error("Unsupported view");
        }

        const data = await fetchYtdMonthlyRevenue();
        if (!mounted) return;

        setYear(data.year);
        setRows(data.months);
        setTotal(data.totalYtd);
      } catch (e) {
        console.error("Failed to load revenue report", e);
        if (!mounted) return;
        setError("Unable to load revenue report.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [view]);

  const max = useMemo(() => {
    return rows.reduce((m, r) => Math.max(m, r.amount || 0), 0);
  }, [rows]);

  if (loading) return <div style={{ padding: "1rem" }}>Loading revenue report…</div>;
  if (error) return <div style={{ padding: "1rem" }}>Error: {error}</div>;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>Revenue Report</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            YTD (Paid) • {year}
          </div>
        </div>

        <button onClick={() => setShowChart((v) => !v)}>
          {showChart ? "Hide Chart" : "Show Chart"}
        </button>
      </div>

      <div style={{ marginTop: "1rem", fontWeight: 700, fontSize: "1.1rem" }}>
        Total YTD: {formatMoney(total)}
      </div>

      {showChart ? (
        <div style={{ marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
          {rows.map((r) => {
            const pct = max > 0 ? (r.amount / max) * 100 : 0;
            return (
              <div key={r.month} style={{ display: "grid", gridTemplateColumns: "60px 1fr 120px", gap: 10, alignItems: "center", margin: "8px 0" }}>
                <div style={{ fontWeight: 600 }}>{r.label}</div>
                <div
  style={{
    position: "absolute",
    left: 0,
    top: 0,
    height: 10,
    width: `${pct}%`,
    background: "#ffffff",
    borderRadius: 999,
    border: "1px solid #111827",
    transition: "width 400ms ease-out",
    transitionDelay: `${r.month * 40}ms`,
  }}
/>

                <div
                    style={{
                        width: `${pct}%`,
                        height: 10,
                        background: "#ffffff",
                        borderRadius: 999,
                        border: "1px solid #111827",
                    }}
                    />

              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ marginTop: "1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "8px 6px" }}>Month</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 6px" }}>{r.label}</td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

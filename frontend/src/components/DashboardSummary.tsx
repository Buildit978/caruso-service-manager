// frontend/src/components/DashboardSummary.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";      // 👈 NEW
import "./Dashboard.css";
import { fetchSummary, type SummaryResponse } from "../api/summary";
import { fetchFinancialSummary } from "../api/invoices";
import { isOutstanding, getOutstandingBalance } from "../utils/outstanding";
import { formatMoney } from "../utils/money"; // assuming you use this




export function DashboardSummary() {
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();                   // 👈 NEW
    
    type PaidScope = "today" | "week" | "month" | "ytd";
    const [paidScope, setPaidScope] = useState<PaidScope>("month");
    const [financial, setFinancial] = useState<any | null>(null); // type later if you want

   function getRange(scope: PaidScope) {
        const now = new Date();

        if (scope === "today") {
            const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            return { from, to };
        }

        if (scope === "week") {
            // Monday-based week
            const day = now.getDay(); // 0=Sun
            const diffToMon = (day + 6) % 7; // Mon=0
            const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMon);
            const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
            return { from, to };
        }

        if (scope === "month") {
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return { from, to };
        }

        // ytd
        const from = new Date(now.getFullYear(), 0, 1); // Jan 1
        const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // tomorrow (inclusive)
        return { from, to };
        }

  function toISODateTime(d: Date) {
  return d.toISOString(); // full UTC timestamp
}



useEffect(() => {
  let isMounted = true;

  async function load() {
    try {
      // 1) load dashboard ops summary
      const summary = await fetchSummary();
      if (!isMounted) return;
      setData(summary);
      setError(null);

      // 2) load scoped paidAt financial summary
    const { from, to } = getRange(paidScope);

        const financialSummary = await fetchFinancialSummary({
        from: toISODateTime(from),
        to: toISODateTime(to),
        });


      if (!isMounted) return;
      setFinancial(financialSummary);
    } catch (err) {
      console.error("Failed to load dashboard", err);
      if (!isMounted) return;
      setError("Unable to load dashboard summary.");
    } finally {
        if (isMounted) {           
            setLoading(false);
        }
    }
  }

  load();

  return () => {
    isMounted = false;
  };
}, [paidScope]);


    if (loading) {
        return (
            <div className="dashboard">
                <p className="dashboard__status">Loading dashboard…</p>
            </div>
        );
    }

if (error || !data || !financial) {
        return (
            <div className="dashboard">
                <p className="dashboard__status dashboard__status--error">
                    Error: {error ?? "No summary data available."}
                </p>
            </div>
        );
    }

   const {
    totalCustomers,
    openWorkOrders,
    completedWorkOrders,
    workOrdersThisWeek,

    // paid truth fields (new)
    revenuePaidAllTime,
    revenuePaidYtd,
    avgOrderValueYtd,
    } = data as any; // tighten type next if needed


    const paidRevenue = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
    }).format(financial.revenuePaid.amount ?? 0);

    const allTimeRevenue = formatMoney(revenuePaidAllTime?.amount ?? 0);
    const ytdRevenue = formatMoney(revenuePaidYtd?.amount ?? 0);



    const outstanding = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
    }).format(financial.outstandingSent.amount ?? 0);

    const formattedAOV = formatMoney(avgOrderValueYtd ?? 0);
    
    const paidScopeLabel =
  paidScope === "today"
    ? "Today"
    : paidScope === "week"
    ? "This Week"
    : "This Month";








    return (
        <div className="dashboard">
        <header className="dashboard__header">
                <div>
                    <h1 className="dashboard__title">Caruso Service Manager</h1>
                    <p className="dashboard__subtitle">
                        Quick snapshot of the shop&apos;s workload and revenue.
          </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={() => setPaidScope("today")}>Today</button>
                <button onClick={() => setPaidScope("week")}>This Week</button>
                <button onClick={() => setPaidScope("month")}>This Month</button>
                </div>

        </header>

            <section className="dashboard__grid">

                 <article className="stat-card stat-card--open stat-card--clickable"
                    onClick={() => navigate("/work-orders")}
                >
                    <div className="stat-card__top">
                        <span className="stat-card__icon">🧰</span>
                        <span className="stat-card__label">Open Work Orders</span>
                    </div>
                    <div className="stat-card__value">{openWorkOrders}</div>
                    <p className="stat-card__hint">
                        Currently in progress or awaiting work.
          </p>
                </article>

                {/* ✅ Completed Work Orders card (clickable) */}
                <article
                className="stat-card stat-card--completed stat-card--clickable"
                onClick={() => navigate("/work-orders?view=to-invoice")}
                >           
                <div className="stat-card__top">
                    <span className="stat-card__icon">✅</span>
                    <span className="stat-card__label">Completed Work Orders</span>
                </div>
                <div className="stat-card__value">{completedWorkOrders}</div>
                <p className="stat-card__hint">Jobs finished and ready to invoice.</p>
                </article>


                <article
                    className="stat-card stat-card--weekly stat-card--clickable"
                    onClick={() => navigate("/work-orders?view=this-week")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate("/work-orders?view=this-week");
                        }
                    }}
                    >
                    <div className="stat-card__top">
                        <span className="stat-card__icon">📅</span>
                        <span className="stat-card__label">Work Orders This Week</span>
                    </div>
                    <div className="stat-card__value">{workOrdersThisWeek}</div>
                    <p className="stat-card__hint">Completed jobs since Monday.</p>
                    </article>


                 <article className="stat-card stat-card--revenue">
                <div className="stat-card__top">
                    <span className="stat-card__icon">✅</span>
                    <span className="stat-card__label">
                    Paid Revenue ({paidScope === "today" ? "Today" : paidScope === "week" ? "This Week" : "This Month"})
                    </span>
                </div>
                <div className="stat-card__value">{paidRevenue}</div>
                <p className="stat-card__hint">Money received (paid invoices).</p>
                </article>

            

                     <article
  className="stat-card stat-card--open stat-card--clickable"
  onClick={() => navigate("/work-orders?view=financial&sub=outstanding")}
>

                <div className="stat-card__top">
                    <span className="stat-card__icon">🧾</span>
                    <span className="stat-card__label">Outstanding</span>
                </div>
                <div className="stat-card__value">{outstanding}</div>
                <p className="stat-card__hint">Sent invoices not yet paid.</p>
                </article>

              <article className="stat-card stat-card--aov">
                <div className="stat-card__top">
                    <span className="stat-card__icon">📈</span>
                    <span className="stat-card__label">Avg Order Value (YTD)</span>
                </div>
                <div className="stat-card__value">{formattedAOV}</div>
                <p className="stat-card__hint">Average paid per invoice this year.</p>
                </article>
                     <article
                className="stat-card stat-card--revenue stat-card--clickable"
                onClick={() => navigate("/reports/revenue?view=ytd")}
                >
                <div className="stat-card__top">
                    <span className="stat-card__icon">📊</span>
                    <span className="stat-card__label">YTD Revenue</span>
                </div>
                <div className="stat-card__value">{ytdRevenue}</div>
                <p className="stat-card__hint">Total paid since Jan 1.</p>
                </article>
                

                <article className="stat-card stat-card--revenue">
                <div className="stat-card__top">
                    <span className="stat-card__icon">💵</span>
                    <span className="stat-card__label">All-Time Revenue</span>
                </div>
                <div className="stat-card__value">{allTimeRevenue}</div>
                <p className="stat-card__hint">Total paid, all time.</p>
                </article>


                <article
                    className="stat-card stat-card--customers stat-card--clickable"
                    onClick={() => navigate("/customers")}
                >
                    <div className="stat-card__top">
                        <span className="stat-card__icon">👥</span>
                        <span className="stat-card__label">Customers</span>
                    </div>
                    <div className="stat-card__value">{totalCustomers}</div>
                    <p className="stat-card__hint">Total customers in the system.</p>
                </article>


                

                

                {/* Optional: show weekly revenue too instead of or in addition */}
                {/* 
        <article className="stat-card stat-card--weekly-revenue">
          <div className="stat-card__top">
            <span className="stat-card__icon">💼</span>
            <span className="stat-card__label">Revenue This Week</span>
          </div>
          <div className="stat-card__value">{formattedRevenueThisWeek}</div>
          <p className="stat-card__hint">
            Revenue from completed jobs this week.
          </p>
        </article>
        */}
            </section>
        </div>
    );
}

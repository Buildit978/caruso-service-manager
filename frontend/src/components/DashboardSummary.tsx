// frontend/src/components/DashboardSummary.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";      // 👈 NEW
import "./Dashboard.css";
import { fetchSummary, type SummaryResponse } from "../api/summary";
import { fetchFinancialSummary } from "../api/invoices";
import { formatMoney } from "../utils/money"; // assuming you use this
import { useSettings } from "../hooks/useSettings";
import { useMe } from "../auth/useMe";
import type { HttpError } from "../api/http";




export function DashboardSummary() {
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | null>(null);
    const navigate = useNavigate();                   // 👈 NEW
    const { me } = useMe();
    
    // Get shop name from settings
    const { shopName } = useSettings();

    // Check if tenant is empty (no work orders)
    const isEmptyTenant = useMemo(() => {
        if (!data) return null;
        // If all counts are 0, consider it empty (but allow for some overlap, so check if any exist)
        return data.openWorkOrders === 0 && data.completedWorkOrders === 0;
    }, [data]);

    // Check if user can create work orders
    const canCreateWorkOrders = me?.role === "owner" || me?.role === "manager";
    
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

      const httpError = err as HttpError;
      
      // Track error status for conditional rendering
      setErrorStatus(httpError?.status || null);
      
      // Friendly permission-aware error messages
      if (httpError.status === 401) {
        setError("Please sign in or create your shop to continue.");
      } else if (httpError.status === 403) {
        setError(null); // Don't show generic error, we'll render the Access Restricted card
      } else {
        setError("Unable to load dashboard summary.");
      }
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

    // Handle 403 - Access Restricted (same styling as Settings page)
    if (errorStatus === 403) {
        return (
            <div className="dashboard">
                <header className="dashboard__header">
                    <div>
                        <h1 className="dashboard__title">Shop Service Manager</h1>
                        {shopName && (
                            <div style={{ fontSize: '0.95rem', color: '#9ca3af', marginTop: '0.25rem', fontWeight: 400 }}>
                                {shopName}
                            </div>
                        )}
                        <p className="dashboard__subtitle">
                            Quick snapshot of the shop&apos;s workload and revenue.
                        </p>
                    </div>
                </header>
                <div
                    style={{
                        maxWidth: "500px",
                        margin: "2rem auto",
                        padding: "1.5rem",
                        border: "1px solid #fbbf24",
                        borderRadius: "0.5rem",
                        background: "rgba(251, 191, 36, 0.1)",
                    }}
                >
                    <h2 style={{ marginTop: 0, color: "#fbbf24", fontSize: "1.2rem" }}>
                        Access Restricted
                    </h2>
                    <p style={{ color: "#e5e7eb", lineHeight: 1.6 }}>
                        Dashboard summary is available only to owners and managers. If you need access, please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    // Handle 401 - Not signed in (similar card styling but different message)
    if (errorStatus === 401) {
        return (
            <div className="dashboard">
                <header className="dashboard__header">
                    <div>
                        <h1 className="dashboard__title">Shop Service Manager</h1>
                        {shopName && (
                            <div style={{ fontSize: '0.95rem', color: '#9ca3af', marginTop: '0.25rem', fontWeight: 400 }}>
                                {shopName}
                            </div>
                        )}
                        <p className="dashboard__subtitle">
                            Quick snapshot of the shop&apos;s workload and revenue.
                        </p>
                    </div>
                </header>
                <div
                    style={{
                        maxWidth: "500px",
                        margin: "2rem auto",
                        padding: "1.5rem",
                        border: "1px solid #4b5563",
                        borderRadius: "0.5rem",
                        background: "rgba(75, 85, 99, 0.1)",
                    }}
                >
                    <h2 style={{ marginTop: 0, color: "#e5e7eb", fontSize: "1.2rem" }}>
                        Not Signed In
                    </h2>
                    <p style={{ color: "#e5e7eb", lineHeight: 1.6, marginBottom: "1rem" }}>
                        {error || "Please sign in to access the dashboard."}
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={() => navigate("/start")}
                            style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.9rem",
                                fontWeight: 600,
                                borderRadius: "0.375rem",
                                border: "none",
                                background: "#2563eb",
                                color: "#ffffff",
                                cursor: "pointer",
                            }}
                        >
                            Create your shop
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.9rem",
                                fontWeight: 400,
                                borderRadius: "0.375rem",
                                border: "1px solid #374151",
                                background: "transparent",
                                color: "#e5e7eb",
                                cursor: "pointer",
                            }}
                        >
                            Sign in
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Handle other errors (network, 500, etc.)
    if (error || !data || !financial) {
        return (
            <div className="dashboard">
                <p className="dashboard__status dashboard__status--error">
                    {error || "No summary data available."}
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

    // Show empty state if tenant has no work orders
    if (isEmptyTenant === true) {
        return (
            <div className="dashboard">
                <header className="dashboard__header">
                    <div>
                        <h1 className="dashboard__title">Shop Service Manager</h1>
                        {shopName && (
                            <div style={{ fontSize: '0.95rem', color: '#9ca3af', marginTop: '0.25rem', fontWeight: 400 }}>
                                {shopName}
                            </div>
                        )}
                        <p className="dashboard__subtitle">
                            Quick snapshot of the shop&apos;s workload and revenue.
                        </p>
                    </div>
                </header>

                <div
                    style={{
                        maxWidth: "600px",
                        margin: "3rem auto",
                        padding: "2rem",
                        border: "1px solid #1f2937",
                        borderRadius: "0.75rem",
                        background: "#020617",
                        textAlign: "center",
                    }}
                >
                    <h2 style={{ marginTop: 0, marginBottom: "0.75rem", color: "#e5e7eb", fontSize: "1.5rem", fontWeight: 600 }}>
                        Welcome to Shop Service Manager
                    </h2>
                    <p style={{ marginBottom: "1.5rem", color: "#9ca3af", lineHeight: 1.6, fontSize: "1rem" }}>
                        Let&apos;s create your first work order to get your shop moving.
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                        {canCreateWorkOrders ? (
                            <button
                                type="button"
                                onClick={() => navigate("/work-orders/new")}
                                style={{
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "1rem",
                                    fontWeight: 600,
                                    borderRadius: "0.5rem",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                }}
                            >
                                Create your first work order
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => navigate("/work-orders")}
                                style={{
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "1rem",
                                    fontWeight: 600,
                                    borderRadius: "0.5rem",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                }}
                            >
                                View work orders
                            </button>
                        )}
                        {me?.role === "owner" && (
                            <button
                                type="button"
                                onClick={() => navigate("/team")}
                                style={{
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "1rem",
                                    fontWeight: 400,
                                    borderRadius: "0.5rem",
                                    border: "1px solid #374151",
                                    background: "transparent",
                                    color: "#e5e7eb",
                                    cursor: "pointer",
                                }}
                            >
                                Add your team
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }








    return (
        <div className="dashboard">
        <header className="dashboard__header">
                <div>
                    <h1 className="dashboard__title">Shop Service Manager</h1>
                    {shopName && (
                        <div style={{ fontSize: '0.95rem', color: '#9ca3af', marginTop: '0.25rem', fontWeight: 400 }}>
                            {shopName}
                        </div>
                    )}
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

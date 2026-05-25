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
        return (data.totalWorkOrders ?? 0) === 0;
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
                            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
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

    // Handle 401 - Not signed in (welcome hero for exploration-first onboarding)
    if (errorStatus === 401) {
        return (
            <div className="dashboard">
                <section
                    style={{
                        maxWidth: "700px",
                        margin: "0 auto",
                        padding: "4rem 1.5rem 5rem",
                        textAlign: "center",
                    }}
                >
                    <h1
                        style={{
                            margin: "0 0 1rem",
                            fontSize: "clamp(2rem, 5vw, 2.75rem)",
                            fontWeight: 700,
                            lineHeight: 1.15,
                            letterSpacing: "-0.02em",
                            color: "#f8fafc",
                        }}
                    >
                        Welcome to Shop Service Manager
                    </h1>

                    <p
                        style={{
                            margin: "0 0 1.75rem",
                            fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
                            fontWeight: 600,
                            lineHeight: 1.4,
                            color: "#e2e8f0",
                        }}
                    >
                        Come on in. Take a look around.
                    </p>

                    <p
                        style={{
                            margin: "0 0 1rem",
                            fontSize: "1.05rem",
                            lineHeight: 1.65,
                            color: "#cbd5e1",
                        }}
                    >
                        Start in Practice Mode, or create your shop and get set up in just a couple of minutes.
                    </p>

                    <p
                        style={{
                            margin: "0 0 2.25rem",
                            fontSize: "1.05rem",
                            lineHeight: 1.65,
                            color: "#94a3b8",
                        }}
                    >
                        Explore how it works, click around, and when you&apos;re ready, switch to live and start working.
                    </p>

                    <div
                        style={{
                            display: "flex",
                            gap: "0.875rem",
                            justifyContent: "center",
                            flexWrap: "wrap",
                            marginBottom: "1.25rem",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => navigate("/start?mode=practice")}
                            style={{
                                padding: "0.875rem 1.75rem",
                                fontSize: "1.05rem",
                                fontWeight: 600,
                                borderRadius: "0.5rem",
                                border: "none",
                                background: "#2563eb",
                                color: "#ffffff",
                                cursor: "pointer",
                            }}
                        >
                            Start in Practice Mode
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/start")}
                            style={{
                                padding: "0.875rem 1.75rem",
                                fontSize: "1.05rem",
                                fontWeight: 600,
                                borderRadius: "0.5rem",
                                border: "1px solid #475569",
                                background: "transparent",
                                color: "#e2e8f0",
                                cursor: "pointer",
                            }}
                        >
                            Create Your Shop
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate("/login")}
                        style={{
                            padding: 0,
                            fontSize: "0.95rem",
                            fontWeight: 500,
                            border: "none",
                            background: "transparent",
                            color: "#94a3b8",
                            cursor: "pointer",
                            textDecoration: "underline",
                            textUnderlineOffset: "0.2em",
                        }}
                    >
                        Sign In
                    </button>

                    <p
                        style={{
                            margin: "2rem 0 0",
                            fontSize: "0.95rem",
                            fontWeight: 500,
                            color: "#64748b",
                        }}
                    >
                        Free for 30 days • No credit card required
                    </p>
                </section>
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
                            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
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
                    <p style={{ marginBottom: "1.5rem", color: "#cbd5e1", lineHeight: 1.6, fontSize: "1rem", fontWeight: 500 }}>
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
                        <div style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
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

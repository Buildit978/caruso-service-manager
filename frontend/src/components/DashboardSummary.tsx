import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";      // 👈 NEW
import "./Dashboard.css";
import { fetchSummary, type SummaryResponse } from "../api/summary";



export function DashboardSummary() {
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();                   // 👈 NEW

    useEffect(() => {
        let isMounted = true;

        async function load() {
            try {
                const summary = await fetchSummary();
                if (!isMounted) return;
                setData(summary);
                setError(null);
            } catch (err) {
                console.error("Failed to load summary", err);
                if (!isMounted) return;
                setError("Unable to load dashboard summary.");
            } finally {
                if (!isMounted) return;
                setLoading(false);
            }
        }

        load();

        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="dashboard">
                <p className="dashboard__status">Loading dashboard…</p>
            </div>
        );
    }

    if (error || !data) {
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
        totalRevenue,
        workOrdersThisWeek,
        revenueThisWeek,
        averageOrderValue,
    } = data;

    const formattedRevenue = new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 2,
    }).format(totalRevenue ?? 0);

    const formattedRevenueThisWeek = new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 2,
    }).format(revenueThisWeek ?? 0);

    const formattedAOV = new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 2,
    }).format(averageOrderValue ?? 0);

    return (
        <div className="dashboard">
            <header className="dashboard__header">
                <div>
                    <h1 className="dashboard__title">Caruso Service Manager</h1>
                    <p className="dashboard__subtitle">
                        Quick snapshot of the shop&apos;s workload and revenue.
          </p>
                </div>
            </header>

            <section className="dashboard__grid">
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

                <article className="stat-card stat-card--completed">
                    <div className="stat-card__top">
                        <span className="stat-card__icon">✅</span>
                        <span className="stat-card__label">Completed Work Orders</span>
                    </div>
                    <div className="stat-card__value">{completedWorkOrders}</div>
                    <p className="stat-card__hint">Jobs finished and ready to invoice.</p>
                </article>

                <article className="stat-card stat-card--revenue">
                    <div className="stat-card__top">
                        <span className="stat-card__icon">💵</span>
                        <span className="stat-card__label">Total Revenue</span>
                    </div>
                    <div className="stat-card__value">{formattedRevenue}</div>
                    <p className="stat-card__hint">All-time revenue from completed orders.</p>
                </article>

                <article className="stat-card stat-card--weekly">
                    <div className="stat-card__top">
                        <span className="stat-card__icon">📅</span>
                        <span className="stat-card__label">Work Orders This Week</span>
                    </div>
                    <div className="stat-card__value">{workOrdersThisWeek}</div>
                    <p className="stat-card__hint">Completed jobs since Monday.</p>
                </article>

                <article className="stat-card stat-card--aov">
                    <div className="stat-card__top">
                        <span className="stat-card__icon">📈</span>
                        <span className="stat-card__label">Avg Order Value</span>
                    </div>
                    <div className="stat-card__value">{formattedAOV}</div>
                    <p className="stat-card__hint">
                        Average revenue per completed work order.
          </p>
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

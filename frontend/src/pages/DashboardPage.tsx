import { useEffect, useState } from 'react';
import { fetchSummary, type SummaryResponse } from '../api/summary';

function formatCurrency(amount: number | undefined) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '—';
  }

  return amount.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        setLoading(true);
        const data = await fetchSummary();
        if (isMounted) {
          setSummary(data);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load summary', err);
        if (isMounted) {
          setError('Unable to load dashboard summary.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="main-content">
      <h1>Dashboard</h1>

      {loading && <p>Loading summary…</p>}

      {error && <p className="error-text">{error}</p>}

      {summary && !loading && !error && (
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-label">Customers</div>
            <div className="dashboard-value">{summary.totalCustomers}</div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-label">Open Work Orders</div>
            <div className="dashboard-value">{summary.openWorkOrders}</div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-label">Completed Work Orders</div>
            <div className="dashboard-value">
              {summary.completedWorkOrders}
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-label">Total Revenue</div>
            <div className="dashboard-value">
              {formatCurrency(summary.totalRevenue)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

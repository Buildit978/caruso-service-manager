import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminAccounts,
  type AdminAccountItem,
  type HttpError,
} from "../../api/admin";
import AdminLayout from "./AdminLayout";
import "./Admin.css";

export default function AdminAccountsPage() {
  const [items, setItems] = useState<AdminAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminAccounts({ limit: 200 })
      .then((res) => {
        if (!cancelled) {
          setItems(res.items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err && typeof err === "object" && "status" in err
            ? (err as HttpError).status === 401
              ? "Unauthorized"
              : (err as HttpError).message
            : "Failed to load accounts";
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout title="Accounts" showBack={false}>
      {loading && <p>Loading accounts…</p>}
      {error && (
        <p style={{ color: "#f87171", marginBottom: "1rem" }}>{error}</p>
      )}
      {!loading && !error && (
        <>
          {/* Mobile: stacked cards */}
          <div className="admin-accounts-cards">
            {items.map((a) => (
              <div key={a.accountId} className="admin-account-card">
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Account</span>
                  <span className="admin-account-card-value">{a.name || a.slug || a.accountId}</span>
                </div>
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Shop</span>
                  <span className="admin-account-card-value">{a.shopName || "—"}</span>
                </div>
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Status</span>
                  <span className="admin-account-card-value">{a.isActive ? "Active" : "Inactive"}</span>
                </div>
                <Link
                  to={`/admin/accounts/${a.accountId}`}
                  state={{ account: a }}
                  className="admin-account-card-link"
                >
                  View & actions
                </Link>
              </div>
            ))}
          </div>

          {/* md+: table */}
          <table className="admin-accounts-table" aria-label="Accounts">
            <thead>
              <tr>
                <th>Account</th>
                <th>Shop</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.accountId}>
                  <td>{a.name || a.slug || a.accountId}</td>
                  <td>{a.shopName || "—"}</td>
                  <td>{a.isActive ? "Active" : "Inactive"}</td>
                  <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <Link
                      to={`/admin/accounts/${a.accountId}`}
                      state={{ account: a }}
                      className="admin-btn admin-btn-primary"
                      style={{ textDecoration: "none" }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && <p>No accounts.</p>}
        </>
      )}
    </AdminLayout>
  );
}

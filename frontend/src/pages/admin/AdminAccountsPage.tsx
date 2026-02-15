import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAdminAccounts,
  type AdminAccountItem,
  type HttpError,
} from "../../api/admin";
import AdminLayout from "./AdminLayout";
import "./Admin.css";

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const TAG_BADGE_KINDS = ["demo", "sales", "internal"] as const;

function TagBadges({ tags }: { tags: string[] | undefined }) {
  if (!tags?.length) return null;
  const show = tags.filter((t) => TAG_BADGE_KINDS.includes(t.toLowerCase() as (typeof TAG_BADGE_KINDS)[number]));
  if (show.length === 0) return null;
  return (
    <span className="admin-tag-badges">
      {show.map((t) => (
        <span key={t} className={`admin-badge admin-badge-tag admin-badge-tag-${t.toLowerCase()}`}>
          {t.toUpperCase()}
        </span>
      ))}
    </span>
  );
}

function BillingStatusBadge({ item }: { item: AdminAccountItem }) {
  if (item.billingExempt) {
    return <span className="admin-badge admin-badge-exempt">Exempt</span>;
  }
  const status = item.billingStatus;
  if (!status) return null;
  return (
    <span className={`admin-badge admin-badge-billing admin-badge-billing-${status}`}>
      {status === "past_due" ? "Past due" : status === "canceled" ? "Canceled" : "Active"}
    </span>
  );
}

function UsageCounts({ counts }: { counts: AdminAccountItem["counts"] }) {
  return (
    <span className="admin-usage-counts">
      WO:{counts.workOrders} Inv:{counts.invoices} Cust:{counts.customers} Users:{counts.users}
    </span>
  );
}

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminAccountItem[]>([]);
  const [paging, setPaging] = useState<{ skip: number; limit: number; returned: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState(7);
  const [region, setRegion] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string>("createdAt_desc");
  const [newFilter, setNewFilter] = useState<"all" | "new">("all");
  const newDays = 7;

  const [demoOnly, setDemoOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<"all" | "demo" | "sales" | "internal">("all");
  const [sortBy, setSortBy] = useState<"created" | "lastActive" | "name" | "billingStatus">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const isDemoAccount = (a: AdminAccountItem) =>
    a.billingExempt === true || (a.accountTags ?? []).map((t) => t.toLowerCase()).includes("demo");

  const filteredItems = items.filter((a) => {
    if (demoOnly && !isDemoAccount(a)) return false;
    if (tagFilter !== "all") {
      const tags = (a.accountTags ?? []).map((t) => t.toLowerCase());
      if (!tags.includes(tagFilter)) return false;
    }
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "created") {
      cmp = (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === "lastActive") {
      const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      cmp = ta - tb;
    } else if (sortBy === "name") {
      const na = (a.name || a.slug || a.accountId).toLowerCase();
      const nb = (b.name || b.slug || b.accountId).toLowerCase();
      cmp = na.localeCompare(nb);
    } else {
      const rank = (x: AdminAccountItem) =>
        x.billingExempt ? 0 : x.billingStatus === "active" ? 1 : x.billingStatus === "past_due" ? 2 : x.billingStatus === "canceled" ? 3 : 4;
      cmp = rank(a) - rank(b);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAdminAccounts({
      days,
      region: region === "all" ? undefined : region,
      status: status === "all" ? undefined : status,
      q: search.trim() || undefined,
      limit: 50,
      skip: 0,
      sort: sort || undefined,
      newOnly: newFilter === "new",
      newDays: newFilter === "new" ? newDays : undefined,
    })
      .then((res) => {
        setItems(res.items);
        setPaging(res.paging);
      })
      .catch((err) => {
        const msg =
          err && typeof err === "object" && "status" in err
            ? (err as HttpError).status === 401
              ? "Unauthorized"
              : (err as HttpError).message
            : "Failed to load accounts";
        setError(msg);
        setItems([]);
        setPaging(null);
      })
      .finally(() => setLoading(false));
  }, [days, region, status, search, sort, newFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function handleRowClick(a: AdminAccountItem) {
    navigate(`/admin/accounts/${a.accountId}`, { state: { account: a } });
  }

  return (
    <AdminLayout title="Accounts" showBack={false}>
      {/* Filters */}
      <div className="admin-accounts-filters">
        <label className="admin-filter-label">
          Days
          <select
            className="admin-filter-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
            aria-label="Days"
          >
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={30}>30</option>
            <option value={90}>90</option>
          </select>
        </label>
        <label className="admin-filter-label">
          Region
          <select
            className="admin-filter-select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Region"
          >
            <option value="all">All</option>
            <option value="Canada">Canada</option>
            <option value="TT">TT</option>
          </select>
        </label>
        <label className="admin-filter-label">
          Status
          <select
            className="admin-filter-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="admin-filter-label admin-filter-search">
          Search
          <input
            type="search"
            className="admin-filter-input"
            placeholder="Name, slug, shop, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            aria-label="Search accounts"
          />
        </label>
        <label className="admin-filter-label">
          Sort
          <select
            className="admin-filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
          >
            <option value="createdAt_desc">Newest</option>
            <option value="createdAt_asc">Oldest</option>
            <option value="lastActive_desc">Last Active</option>
          </select>
        </label>
        <label className="admin-filter-label">
          Filter
          <select
            className="admin-filter-select"
            value={newFilter}
            onChange={(e) => setNewFilter(e.target.value as "all" | "new")}
            aria-label="Filter new"
          >
            <option value="all">All</option>
            <option value="new">New (7d)</option>
          </select>
        </label>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={load}>
          Apply
        </button>
      </div>

      {/* Client-side filter + sort bar */}
      {!loading && !error && items.length > 0 && (
        <div className="admin-accounts-filter-sort-bar">
          <label className="admin-filter-label admin-filter-checkbox">
            <input
              type="checkbox"
              checked={demoOnly}
              onChange={(e) => setDemoOnly(e.target.checked)}
              aria-label="Demo only"
            />
            Demo only
          </label>
          <label className="admin-filter-label">
            Tag
            <select
              className="admin-filter-select"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value as typeof tagFilter)}
              aria-label="Tag filter"
            >
              <option value="all">All</option>
              <option value="demo">demo</option>
              <option value="sales">sales</option>
              <option value="internal">internal</option>
            </select>
          </label>
          <label className="admin-filter-label">
            Sort by
            <select
              className="admin-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort by"
            >
              <option value="created">Created (newest)</option>
              <option value="lastActive">Last Active</option>
              <option value="name">Name (A–Z)</option>
              <option value="billingStatus">Billing Status</option>
            </select>
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-secondary admin-sort-dir-btn"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
      )}

      {loading && <p className="admin-accounts-loading">Loading accounts…</p>}
      {error && <p className="admin-gate-error admin-accounts-error">{error}</p>}

      {!loading && !error && (
        <>
          {sortedItems.length === 0 ? (
            <p className="admin-accounts-empty">
              {items.length === 0 ? "No accounts match the current filters." : "No accounts match the demo/tag filters."}
            </p>
          ) : (
            <>
              {/* Mobile: cards (clickable) */}
              <div className="admin-accounts-cards">
                {sortedItems.map((a) => (
                  <button
                    type="button"
                    key={a.accountId}
                    className="admin-account-card admin-account-card-clickable"
                    onClick={() => handleRowClick(a)}
                  >
                    <div className="admin-account-card-row">
                      <span className="admin-account-card-label">Account</span>
                      <span className="admin-account-card-value">
                        {a.name || a.slug || a.accountId}
                        {a.isNew && <span className="admin-badge admin-badge-new">New</span>}
                        <TagBadges tags={a.accountTags} />
                      </span>
                    </div>
                    <div className="admin-account-card-row">
                      <span className="admin-account-card-label">Region</span>
                      <span className="admin-account-card-value">{a.region || "—"}</span>
                    </div>
                    <div className="admin-account-card-row">
                      <span className="admin-account-card-label">Created</span>
                      <span className="admin-account-card-value">{formatDate(a.createdAt)}</span>
                    </div>
                    <div className="admin-account-card-row">
                      <span className="admin-account-card-label">Last Active</span>
                      <span className="admin-account-card-value">{formatDateTime(a.lastActiveAt)}</span>
                    </div>
                    <div className="admin-account-card-row">
                      <span className="admin-account-card-label">Usage</span>
                      <span className="admin-account-card-value">
                        <UsageCounts counts={a.counts} />
                      </span>
                    </div>
                    <div className="admin-account-card-row">
                      <span className="admin-account-card-label">Status</span>
                      <span className="admin-account-card-value">
                        {a.isActive ? "Active" : "Inactive"}
                        <BillingStatusBadge item={a} />
                      </span>
                    </div>
                    <span className="admin-account-card-cta">View & actions →</span>
                  </button>
                ))}
              </div>

              {/* md+: table (row click) */}
              <div className="admin-accounts-table-wrap">
                <table className="admin-accounts-table" aria-label="Accounts">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Primary Owner</th>
                      <th>Region</th>
                      <th>Created</th>
                      <th>Last Active</th>
                      <th>Usage</th>
                      <th>Status</th>
                      <th>Billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((a) => (
                      <tr
                        key={a.accountId}
                        className="admin-accounts-table-row-clickable"
                        onClick={() => handleRowClick(a)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick(a);
                          }
                        }}
                        aria-label={`View ${a.name || a.slug || a.accountId}`}
                      >
                        <td>
                          {a.name || a.slug || a.accountId}
                          {a.isNew && <span className="admin-badge admin-badge-new">New</span>}
                          <TagBadges tags={a.accountTags} />
                        </td>
                        <td title={a.primaryOwnerDisplayName ?? "—"}>
                          {(a.primaryOwnerDisplayName ?? "—").length > 24
                            ? `${(a.primaryOwnerDisplayName ?? "—").slice(0, 24)}…`
                            : (a.primaryOwnerDisplayName ?? "—")}
                        </td>
                        <td>{a.region || "—"}</td>
                        <td>{formatDate(a.createdAt)}</td>
                        <td>{formatDateTime(a.lastActiveAt)}</td>
                        <td>
                          <UsageCounts counts={a.counts} />
                        </td>
                        <td>{a.isActive ? "Active" : "Inactive"}</td>
                        <td><BillingStatusBadge item={a} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {paging && paging.total > 0 && (
                <p className="admin-accounts-paging">
                  Showing {sortedItems.length} of {paging.returned} loaded
                  {filteredItems.length < items.length && ` (${items.length} total)`}
                  {" · "}{paging.total} total account{paging.total !== 1 ? "s" : ""}.
                </p>
              )}
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
}

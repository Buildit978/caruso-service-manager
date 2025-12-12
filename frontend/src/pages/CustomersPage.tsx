// frontend/src/pages/CustomersPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Customer } from "../types/customer";
import { fetchCustomers } from "../api/customers";



export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "name-asc" | "name-desc" | "createdAt-desc" | "createdAt-asc"
  >("name-asc");

  // If you already have a search state, keep it.
  // If not, this is optional but handy:



  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        let sortBy: "name" | "createdAt";
        let sortDir: "asc" | "desc";

        switch (sort) {
          case "name-asc":
            sortBy = "name";
            sortDir = "asc";
            break;
          case "name-desc":
            sortBy = "name";
            sortDir = "desc";
            break;
          case "createdAt-asc":
            sortBy = "createdAt";
            sortDir = "asc";
            break;
          case "createdAt-desc":
          default:
            sortBy = "createdAt";
            sortDir = "desc";
            break;
        }

        const customersData = await fetchCustomers({
          search,
          sortBy,
          sortDir,
        });

        setCustomers(customersData);
      } catch (err) {
        console.error("[CustomersPage] load error", err);
        setError("Could not load customers.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [search, sort]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header (match Work Orders) */}
      <div className="mb-6">
        <div
          style={{
            maxWidth: "1100px",
            marginLeft: "auto",
            marginRight: "auto",
            paddingRight: "100px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Left: Title */}
          <h1 className="text-2xl font-semibold">Customers</h1>

          {/* Right: Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            {/* 🔍 Search */}
            <input
              type="text"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                height: "32px",
                padding: "0 10px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "white",
                color: "#111827",
                minWidth: "220px",
              }}
            />

            {/* 🔃 Sort */}
            <select
              value={sort}
              onChange={(e) =>
                setSort(
                  e.target.value as
                  | "name-asc"
                  | "name-desc"
                  | "createdAt-desc"
                  | "createdAt-asc"
                )
              }
              style={{
                height: "32px",
                padding: "0 8px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "white",
                color: "#111827",
              }}
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="createdAt-desc">Created (Newest)</option>
              <option value="createdAt-asc">Created (Oldest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table (unchanged content, just wrapped cleanly) */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                Name
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                Phone
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                Email
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                Open WOs
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {customers.map((c) => (
              <tr key={c._id}>
                <td style={{ padding: "0.5rem 0", paddingLeft: "20px" }}>
                  {c.fullName || `${c.firstName} ${c.lastName}`}
                </td>
                <td>{c.phone || "-"}</td>
                <td>{c.email || "-"}</td>
                <td>{c.openWorkOrders ?? c.openWorkOrdersCount ?? 0}</td>
                <td>
                  <Link to={`/customers/${c._id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
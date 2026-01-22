// src/pages/CustomerEditPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchCustomer, updateCustomer, type CustomerPayload } from "../api/customers";
import type { HttpError } from "../api/http";

type CustomerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
};

export default function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = searchParams.get("returnTo") || "/customers";

  useEffect(() => {
    if (!id) return;

        const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchCustomer(id);

        setForm({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
        });
      } catch (err: any) {
        console.error("[Customer Edit] Failed to load customer", err);
        setError(err.message || "Failed to load customer.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setSaving(true);
      setError(null);

      const payload: Partial<CustomerPayload> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };

      await updateCustomer(id, payload);
      alert("✅ Customer updated.");
      navigate(returnTo);
    } catch (err: any) {
      console.error("[Customer Edit] Failed to update customer", err);
      const httpError = err as HttpError;
      
      // Friendly 403 message
      if (httpError?.status === 403) {
        setError("You don't have permission to edit customer details.");
        alert("You don't have permission to edit customer details.");
      } else {
        setError(err.message || "Failed to update customer.");
        alert("❌ Failed to update customer.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        Loading customer…
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "720px" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>
            Edit Customer
          </h1>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              fontSize: "0.9rem",
              padding: "0.4rem 0.9rem",
              borderRadius: "0.4rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
            }}
            disabled={saving}
          >
            Back
          </button>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#020617",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          }}
        >
          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #fecaca",
                background: "#fee2e2",
                color: "#7f1d1d",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* First Name */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>First Name</span>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
              />
            </label>

            {/* Last Name */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Last Name</span>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
              />
            </label>

            {/* Phone */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Phone (optional)</span>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
              />
            </label>

            {/* Email */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Email (optional)</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
              />
            </label>

            {/* Address */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Address (optional)</span>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                  lineHeight: "1.4",
                  resize: "vertical",
                }}
              />
            </label>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => navigate(returnTo)}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// src/pages/CustomerCreatePage.tsx
import {
  useState,
  useEffect,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createCustomer } from "../api/customers";
import { createVehicle, type NewVehiclePayload } from "../api/vehicles";
import { getBillingLockState, subscribe, isBillingLockedError } from "../state/billingLock";

type CustomerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
};

export default function CustomerCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingLocked, setBillingLocked] = useState(() => getBillingLockState().billingLocked);
  useEffect(() => {
    return subscribe((s) => setBillingLocked(s.billingLocked));
  }, []);

  const [showVehicleForm, setShowVehicleForm] = useState(false);

  const [newVehicle, setNewVehicle] = useState({
    year: "",
    make: "",
    model: "",
    vin: "",
    licensePlate: "",
    color: "",
    notes: "",
    odometer: "",
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setSaving(true);

      // 1) Create the customer first
      const customerPayload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        name: `${form.firstName} ${form.lastName}`.trim(), // if your backend uses "name"
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };

      const createdCustomer = await createCustomer(customerPayload);

      // 2) Optionally create the first vehicle
      if (
        showVehicleForm &&
        newVehicle.make.trim() &&
        newVehicle.model.trim()
      ) {
        const vehiclePayload: NewVehiclePayload = {
          customerId: createdCustomer._id,
          vin: newVehicle.vin || undefined,
          year: newVehicle.year ? Number(newVehicle.year) : undefined,
          make: newVehicle.make.trim(),
          model: newVehicle.model.trim(),
          licensePlate: newVehicle.licensePlate || undefined,
          color: newVehicle.color || undefined,
          notes: newVehicle.notes || undefined,
          odometer: newVehicle.odometer
            ? Number(newVehicle.odometer)
            : undefined,
        };

        try {
          await createVehicle(vehiclePayload);
        } catch (err) {
          console.error(
            "[New Customer] Failed to create initial vehicle",
            err
          );
          // Don't block the customer create flow.
        }
      }

      // 3) Navigate / redirect as you already do
      const params = new URLSearchParams(location.search);
      const returnTo = params.get("returnTo");
      if (returnTo === "create-work-order") {
        navigate(`/work-orders/new?customerId=${createdCustomer._id}`);
      } else {
        navigate(`/customers/${createdCustomer._id}`);
      }
    } catch (err: any) {
      console.error("[New Customer] Failed to save", err);
      setError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : err.message || "Could not save customer.");
    } finally {
      setSaving(false);
    }
  };

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
            Add New Customer
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
            background: "#020617", // dark card; change to "#fff" for light
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

            {/* First Vehicle (optional) */}
            <div
              style={{
                marginTop: "1.25rem",
                paddingTop: "1rem",
                borderTop: "1px solid #1f2937",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{ fontSize: "0.9rem", fontWeight: 500 }}
                >
                  Vehicle (optional)
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setShowVehicleForm((prev) => !prev)
                  }
                  style={{
                    border: "none",
                    background: "none",
                    color: "#60a5fa",
                    textDecoration: "underline",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {showVehicleForm
                    ? "Remove vehicle from this customer"
                    : "Add a vehicle for this customer"}
                </button>
              </div>

              {showVehicleForm && (
                <div
                  style={{
                    border: "1px solid #374151",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    background: "#020617",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Year
                      </label>
                      <input
                        type="text"
                        value={newVehicle.year}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            year: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Make *
                      </label>
                      <input
                        type="text"
                        value={newVehicle.make}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            make: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Model *
                      </label>
                      <input
                        type="text"
                        value={newVehicle.model}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            model: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Plate
                      </label>
                      <input
                        type="text"
                        value={newVehicle.licensePlate}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            licensePlate: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        VIN
                      </label>
                      <input
                        type="text"
                        value={newVehicle.vin}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            vin: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Color
                      </label>
                      <input
                        type="text"
                        value={newVehicle.color}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            color: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Odometer (km)
                      </label>
                      <input
                        type="number"
                        value={newVehicle.odometer}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            odometer: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: "0.15rem",
                        }}
                      >
                        Vehicle notes
                      </label>
                      <textarea
                        rows={2}
                        value={newVehicle.notes}
                        onChange={(e) =>
                          setNewVehicle((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #475569",
                          fontSize: "0.8rem",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                disabled={saving || billingLocked}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                  opacity: saving || billingLocked ? 0.6 : 1,
                  cursor: saving || billingLocked ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save Customer"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
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

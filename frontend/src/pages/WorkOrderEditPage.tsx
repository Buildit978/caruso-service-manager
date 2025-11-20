import type React from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { WorkOrder, WorkOrderLineItem } from "../types/workOrder";
import type { Customer } from "../types/customer";
import { fetchWorkOrder, updateWorkOrder } from "../api/workOrders";

// Helper: parse "Qty / Hours" input.
// Supports "1.5", "1,5", "1:15" (1 hour 15 min => 1.25), etc.
function parseQuantityInput(raw: string): number {
  const value = raw.trim();
  if (!value) return 0;

  if (value.includes(":")) {
    const [hStr, mStr] = value.split(":");
    const hours = Number(hStr) || 0;
    const minutes = Number(mStr) || 0;
    return hours + minutes / 60;
  }

  const num = Number(value.replace(",", "."));
  return Number.isNaN(num) ? 0 : num;
}

export default function WorkOrderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 👉 this is the work order we're editing
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    complaint: "",
    diagnosis: "",
    notes: "",
    odometer: "",
    status: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleLicensePlate: "",
    vehicleVin: "",
    vehicleColor: "",
    vehicleNotes: "",
  });

  const [lineItems, setLineItems] = useState<WorkOrderLineItem[]>([]);
  const [quantityInputs, setQuantityInputs] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState<number>(13);

  // Load work order
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const data = await fetchWorkOrder(id);

        setWorkOrder(data);
        const initialLineItems = data.lineItems ?? [];
        setLineItems(initialLineItems);
        setQuantityInputs(
          initialLineItems.map((item) =>
            item.quantity !== undefined && item.quantity !== null
              ? String(item.quantity)
              : ""
          )
        );
        setTaxRate(data.taxRate ?? 13);

        setForm({
          complaint: data.complaint || "",
          diagnosis: data.diagnosis || "",
          notes: data.notes || "",
          odometer:
            data.odometer !== undefined && data.odometer !== null
              ? String(data.odometer)
              : "",
          status: data.status || "",
          vehicleYear:
            data.vehicle?.year !== undefined && data.vehicle?.year !== null
              ? String(data.vehicle.year)
              : "",
          vehicleMake: data.vehicle?.make || "",
          vehicleModel: data.vehicle?.model || "",
          vehicleLicensePlate: data.vehicle?.licensePlate || "",
          vehicleVin: data.vehicle?.vin || "",
          vehicleColor: data.vehicle?.color || "",
          vehicleNotes: data.vehicle?.notes || "",
        });
      } catch (err) {
        console.error("Error loading work order", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // 👉 derive customer + display name from workOrder
  const customer =
    (workOrder?.customerId && typeof workOrder.customerId === "object"
      ? workOrder.customerId
      : workOrder?.customer) as Customer | undefined;

  const customerName =
    customer?.fullName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "(No name)";

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workOrder?._id) return;

    const payload: Partial<WorkOrder> = {
      complaint: form.complaint,
      diagnosis: form.diagnosis,
      notes: form.notes,
      odometer:
        form.odometer.trim() === ""
          ? undefined
          : Number(form.odometer.trim()),
      status: form.status ? (form.status as WorkOrder["status"]) : undefined,
      vehicle: (() => {
        const hasVehicleValues =
          form.vehicleYear ||
          form.vehicleMake ||
          form.vehicleModel ||
          form.vehicleLicensePlate ||
          form.vehicleVin ||
          form.vehicleColor ||
          form.vehicleNotes;

        if (!hasVehicleValues) return undefined;

        const yearNum =
          form.vehicleYear.trim() === ""
            ? undefined
            : Number(form.vehicleYear.trim());

        return {
          year: Number.isNaN(yearNum) ? undefined : yearNum,
          make: form.vehicleMake || undefined,
          model: form.vehicleModel || undefined,
          licensePlate: form.vehicleLicensePlate || undefined,
          vin: form.vehicleVin || undefined,
          color: form.vehicleColor || undefined,
          notes: form.vehicleNotes || undefined,
        };
      })(),
      lineItems,
      taxRate,
    };

    await updateWorkOrder(workOrder._id, payload);

    alert("✅ Work order updated");
    navigate(`/work-orders/${workOrder._id}`);
  };

  const handleLineItemChange = (
    index: number,
    field: keyof WorkOrderLineItem,
    value: string
  ) => {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };

      if (field === "unitPrice") {
        const num = Number(value) || 0;
        (item as any).unitPrice = num;
      } else if (field === "type") {
        (item as any).type = value as WorkOrderLineItem["type"];
      } else {
        (item as any)[field] = value;
      }

      const qty = (item as any).quantity ?? 0;
      const price = (item as any).unitPrice ?? 0;
      (item as any).lineTotal = qty * price;

      next[index] = item;
      return next;
    });
  };

  const handleQuantityChange = (index: number, raw: string) => {
    setQuantityInputs((prev) => {
      const next = [...prev];
      next[index] = raw;
      return next;
    });

    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const qty = parseQuantityInput(raw);
      (item as any).quantity = qty;
      const price = (item as any).unitPrice ?? 0;
      (item as any).lineTotal = qty * price;
      next[index] = item;
      return next;
    });
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        type: "labour",
        description: "",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      } as WorkOrderLineItem,
    ]);
    setQuantityInputs((prev) => [...prev, "1"]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setQuantityInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const computedSubtotal = (lineItems ?? []).reduce(
    (sum, item) => sum + (item.lineTotal || 0),
    0
  );
  const computedTaxAmount = computedSubtotal * (taxRate / 100);
  const computedTotal = computedSubtotal + computedTaxAmount;

  const formatMoney = (value: number | undefined | null) =>
    Number(value ?? 0).toFixed(2);

  if (loading) return <div style={{ padding: "1rem" }}>Loading...</div>;

  return (
    <div
      style={{
        padding: "2rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "960px" }}>
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
            Edit Work Order
          </h1>

          <button
            type="button"
            onClick={() => navigate(`/work-orders/${id}`)}
            style={{
              fontSize: "0.9rem",
              padding: "0.4rem 0.9rem",
              borderRadius: "0.4rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
            }}
          >
            Back
          </button>
        </div>

        {/* Card */}
        <div
          style={{
            width: "100%",
            padding: "1.25rem 1.5rem",
            borderRadius: "0.75rem",
            background: "#020617",
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          }}
        >
          {/* CUSTOMER CONTEXT */}
          {customer && (
            <section
              style={{
                marginBottom: "1.25rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #1f2937",
                background: "#020617",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{customerName}</div>
                  <div style={{ color: "#9ca3af" }}>
                    {customer.phone && <>📞 {customer.phone}</>}
                    {customer.phone && customer.email && " · "}
                    {customer.email && <>✉️ {customer.email}</>}
                  </div>
                  {customer.address && (
                    <div style={{ color: "#9ca3af" }}>{customer.address}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/customers/${customer._id}/edit?returnTo=/work-orders/${workOrder?._id}/edit`
                    )
                  }
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.3rem 0.7rem",
                    borderRadius: "0.4rem",
                    border: "1px solid #4b5563",
                    background: "transparent",
                    color: "#e5e7eb",
                    cursor: "pointer",
                    height: "fit-content",
                  }}
                >
                  Edit Customer
                </button>
              </div>
            </section>
          )}

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              margin: 0,
              padding: 0,
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Complaint</span>
              <textarea
                name="complaint"
                value={form.complaint}
                onChange={handleChange}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: "0.25rem",
                  marginBottom: "0.25rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #4b5563",
                  backgroundColor: "#303036",
                  fontSize: "1rem",
                  lineHeight: "1.4",
                  resize: "vertical",
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Diagnosis</span>
              <textarea
                name="diagnosis"
                value={form.diagnosis}
                onChange={handleChange}
                rows={4}
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

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Notes</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
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

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Odometer</span>
              <input
                name="odometer"
                value={form.odometer}
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

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Status</span>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
              >
                <option value="">Select status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="invoiced">Invoiced</option>
              </select>
            </label>

            {/* Vehicle snapshot */}
            <div
              style={{
                border: "1px solid #1f2937",
                borderRadius: "0.5rem",
                padding: "1rem",
                display: "grid",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontWeight: 600 }}>Vehicle</div>

              <div
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span>Year</span>
                  <input
                    name="vehicleYear"
                    value={form.vehicleYear}
                    onChange={handleChange}
                    type="number"
                    min={1900}
                    max={2100}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #475569",
                      fontSize: "1rem",
                    }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span>Make</span>
                  <input
                    name="vehicleMake"
                    value={form.vehicleMake}
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

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span>Model</span>
                  <input
                    name="vehicleModel"
                    value={form.vehicleModel}
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

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span>License Plate</span>
                  <input
                    name="vehicleLicensePlate"
                    value={form.vehicleLicensePlate}
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

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span>VIN</span>
                  <input
                    name="vehicleVin"
                    value={form.vehicleVin}
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

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span>Color</span>
                  <input
                    name="vehicleColor"
                    value={form.vehicleColor}
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
              </div>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <span>Vehicle Notes</span>
                <textarea
                  name="vehicleNotes"
                  value={form.vehicleNotes}
                  onChange={handleChange}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #475569",
                    fontSize: "1rem",
                  }}
                />
              </label>
            </div>

            {/* LINE ITEMS */}
            <section
              className="mt-4 rounded-xl bg-[#050715] p-6 shadow"
              style={{ marginTop: "1.25rem" }}
            >
              {/* Header row: title + Add Line button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                }}
              >
                <h2 className="mb-0 text-lg font-semibold text-white">
                  Line Items
                </h2>

                <button
                  type="button"
                  onClick={handleAddLineItem}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "4px",
                    border: "1px solid #111827",
                    backgroundColor: "#111827",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  + Add Line
                </button>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1f2937" }}>
                      <th
                        style={{ textAlign: "left", padding: "8px 12px" }}
                      >
                        Type
                      </th>
                      <th
                        style={{ textAlign: "left", padding: "8px 12px" }}
                      >
                        Description
                      </th>
                      <th
                        style={{ textAlign: "right", padding: "8px 12px" }}
                      >
                        Qty / Hours
                      </th>
                      <th
                        style={{ textAlign: "right", padding: "8px 12px" }}
                      >
                        Unit Price
                      </th>
                      <th
                        style={{ textAlign: "right", padding: "8px 12px" }}
                      >
                        Line Total
                      </th>
                      <th
                        style={{ padding: "8px 12px", width: "1%" }}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {(!lineItems || lineItems.length === 0) && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#9ca3af",
                          }}
                        >
                          No line items yet. Click &ldquo;Add Line&rdquo; to
                          get started.
                        </td>
                      </tr>
                    )}

                    {(lineItems ?? []).map((item, index) => {
                      const quantity = Number(item.quantity ?? 0);
                      const unitPrice = Number(item.unitPrice ?? 0);

                      const lineTotal =
                        typeof item.lineTotal === "number"
                          ? item.lineTotal
                          : quantity * unitPrice;

                      return (
                        <tr
                          key={index}
                          style={{ borderTop: "1px solid #111827" }}
                        >
                          {/* Type */}
                          <td style={{ padding: "8px 12px" }}>
                            <select
                              value={item.type}
                              onChange={(e) =>
                                handleLineItemChange(
                                  index,
                                  "type",
                                  e.target.value
                                )
                              }
                              style={{
                                border: "1px solid #4b5563",
                                borderRadius: "4px",
                                padding: "4px 6px",
                                fontSize: "0.85rem",
                                backgroundColor: "#020617",
                                color: "#e5e7eb",
                              }}
                            >
                              <option value="labour">Labour</option>
                              <option value="part">Part</option>
                              <option value="service">Service</option>
                            </select>
                          </td>

                          {/* Description */}
                          <td style={{ padding: "8px 12px" }}>
                            <input
                              type="text"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                handleLineItemChange(
                                  index,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder={
                                item.type === "labour"
                                  ? "e.g. Brake inspection"
                                  : item.type === "part"
                                  ? "e.g. Brake pads"
                                  : "e.g. Shop supplies"
                              }
                              style={{
                                width: "100%",
                                border: "1px solid #4b5563",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "0.85rem",
                                backgroundColor: "#020617",
                                color: "#e5e7eb",
                              }}
                            />
                          </td>

                          {/* Qty / Hours */}
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                            }}
                          >
                            <input
                              type="text"
                              value={quantityInputs[index] ?? ""}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              placeholder={
                                item.type === "labour"
                                  ? "e.g. 1:15"
                                  : "Qty"
                              }
                              style={{
                                width: "120px",
                                border: "1px solid #4b5563",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "0.85rem",
                                textAlign: "right",
                                backgroundColor: "#020617",
                                color: "#e5e7eb",
                              }}
                            />
                          </td>

                          {/* Unit Price */}
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                            }}
                          >
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={unitPrice === 0 ? "" : unitPrice}
                              onChange={(e) =>
                                handleLineItemChange(
                                  index,
                                  "unitPrice",
                                  e.target.value
                                )
                              }
                              placeholder={
                                item.type === "labour"
                                  ? "Rate/hr"
                                  : "Price"
                              }
                              style={{
                                width: "140px",
                                border: "1px solid #4b5563",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "0.85rem",
                                textAlign: "right",
                                backgroundColor: "#020617",
                                color: "#e5e7eb",
                              }}
                            />
                          </td>

                          {/* Line Total */}
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                            }}
                          >
                            {formatMoney(lineTotal)}
                          </td>

                          {/* Remove */}
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveLineItem(index)
                              }
                              style={{
                                border: "none",
                                background: "none",
                                color: "#f97373",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "4px",
                  fontSize: "0.9rem",
                }}
              >
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ fontWeight: 600 }}>Subtotal:</span>
                  <span>${formatMoney(computedSubtotal)}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Tax Rate:</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={taxRate}
                    onChange={(e) =>
                      setTaxRate(Number(e.target.value) || 0)
                    }
                    style={{
                      width: "80px",
                      border: "1px solid #4b5563",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                    }}
                  />
                  <span>%</span>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ fontWeight: 600 }}>Tax Amount:</span>
                  <span>${formatMoney(computedTaxAmount)}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    fontWeight: 700,
                    fontSize: "1rem",
                    marginTop: "4px",
                  }}
                >
                  <span>Total:</span>
                  <span>${formatMoney(computedTotal)}</span>
                </div>
              </div>
            </section>

            {/* Footer buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "1.5rem",
              }}
            >
              <button
                type="submit"
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => navigate(`/work-orders/${id}`)}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.95rem",
                }}
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

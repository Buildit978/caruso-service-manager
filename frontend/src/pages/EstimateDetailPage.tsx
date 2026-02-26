// frontend/src/pages/EstimateDetailPage.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchEstimate,
  updateEstimate,
  sendEstimate,
  resendEstimate,
  approveEstimate,
  convertEstimateToWorkOrder,
  type Estimate,
  type EstimateLineItem,
} from "../api/estimates";
import { getCustomerVehicles, type Vehicle } from "../api/vehicles";
import { formatMoney } from "../utils/money";
import { httpBlob, type HttpError } from "../api/http";

function resolveCustomerId(est: Estimate): string | null {
  const c = est.customerId;
  if (!c) return null;
  if (typeof c === "string") return c;
  return (c as { _id?: string })?._id ?? null;
}

function resolveVehicleId(est: Estimate): string | null {
  const v = est.vehicleId;
  if (!v) return null;
  if (typeof v === "string") return v;
  return (v as { _id?: string })?._id ?? null;
}

function formatVehicleSummary(v: Estimate["vehicleId"]): string | null {
  if (!v || typeof v === "string") return null;
  const o = v as { year?: number; make?: string; model?: string; licensePlate?: string };
  const parts = [o.year, o.make, o.model].filter(Boolean);
  const base = parts.join(" ");
  if (!base.trim()) return null;
  return o.licensePlate ? `${base} (${o.licensePlate})` : base;
}

/** Sanitize phone input: allow only digits, spaces, +, (), -, . */
const sanitizePhoneInput = (raw: string): string =>
  raw.replace(/[^\d\s+\-().]/g, "");

/** Parse "H:MM" or decimal to hours (e.g. "1:25" → 1.416…). */
const parseQuantityInput = (raw: string): number => {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (trimmed.includes(":")) {
    const [hStr, mStr] = trimmed.split(":");
    const hours = Number(hStr) || 0;
    const minutes = Number(mStr) || 0;
    return hours + minutes / 60;
  }
  return Number(trimmed) || 0;
};

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [nonClientName, setNonClientName] = useState("");
  const [nonClientLastName, setNonClientLastName] = useState("");
  const [nonClientPhone, setNonClientPhone] = useState("");
  const [nonClientEmail, setNonClientEmail] = useState("");
  const [nonClientYear, setNonClientYear] = useState("");
  const [nonClientMake, setNonClientMake] = useState("");
  const [nonClientModel, setNonClientModel] = useState("");
  const [items, setItems] = useState<EstimateLineItem[]>([]);
  const [rawQuantities, setRawQuantities] = useState<string[]>([]);
  const [rawUnitPrices, setRawUnitPrices] = useState<string[]>([]);
  const initialRef = useRef<string>("");

  useEffect(() => {
    if (!id) {
      setError("No estimate ID provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchEstimate(id)
      .then((data) => {
        if (!cancelled) {
          const loadedItems = Array.isArray(data.items) ? [...data.items] : [];
          const isNonClientData = (data as any)?.kind === "non_client";
          const nc = data.nonClient;
          setEstimate(data);
          setCustomerNotes(data.customerNotes ?? "");
          setInternalNotes(data.internalNotes ?? "");
          setVehicleId(resolveVehicleId(data) ?? null);
          if (isNonClientData && nc) {
            setNonClientName(nc.name ?? "");
            setNonClientLastName(nc.lastName ?? "");
            setNonClientPhone(nc.phone ?? "");
            setNonClientEmail(nc.email ?? "");
            setNonClientYear(nc.vehicle?.year != null ? String(nc.vehicle.year) : "");
            setNonClientMake(nc.vehicle?.make ?? "");
            setNonClientModel(nc.vehicle?.model ?? "");
          }
          setItems(loadedItems);
          setRawQuantities(loadedItems.map((it) => (it.quantity == null || it.quantity === 0 ? "" : String(it.quantity))));
          setRawUnitPrices(loadedItems.map((it) => (it.unitPrice == null || it.unitPrice === 0 ? "" : String(it.unitPrice))));
          const ncForRef = isNonClientData && nc
            ? {
                name: nc.name ?? "",
                lastName: nc.lastName ?? "",
                phone: nc.phone ?? "",
                email: nc.email ?? "",
                vehicle: {
                  year: nc.vehicle?.year != null ? String(nc.vehicle.year) : "",
                  make: nc.vehicle?.make ?? "",
                  model: nc.vehicle?.model ?? "",
                },
              }
            : { name: "", lastName: "", phone: "", email: "", vehicle: { year: "", make: "", model: "" } };
          initialRef.current = JSON.stringify({
            customerNotes: data.customerNotes ?? "",
            internalNotes: data.internalNotes ?? "",
            vehicleId: resolveVehicleId(data) ?? null,
            nonClient: ncForRef,
            items: data.items ?? [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load estimate.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const customerId = estimate ? resolveCustomerId(estimate) : null;

  useEffect(() => {
    if (!customerId) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    setVehiclesLoading(true);
    getCustomerVehicles(customerId)
      .then((data) => {
        if (!cancelled) setVehicles(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!estimate) return;
    const nonClientObj = {
      name: nonClientName,
      lastName: nonClientLastName,
      phone: nonClientPhone,
      email: nonClientEmail,
      vehicle: {
        year: nonClientYear,
        make: nonClientMake,
        model: nonClientModel,
      },
    };
    const current = JSON.stringify({
      customerNotes,
      internalNotes,
      vehicleId,
      nonClient: nonClientObj,
      items,
    });
    setDirty(current !== initialRef.current);
  }, [customerNotes, internalNotes, vehicleId, nonClientName, nonClientLastName, nonClientPhone, nonClientEmail, nonClientYear, nonClientMake, nonClientModel, items, estimate]);

  const isNonClient = (estimate as any)?.kind === "non_client";
  const nonClientPhoneDigits = (nonClientPhone ?? "").replace(/\D/g, "");
  const nonClientComplete =
    nonClientName.trim() &&
    nonClientLastName.trim() &&
    nonClientPhoneDigits.length >= 7 &&
    nonClientYear.trim() &&
    nonClientMake.trim() &&
    nonClientModel.trim();

  const handleSave = async () => {
    if (!id || !dirty || estimate?.status !== "draft") return;
    if (isNonClient ? !nonClientComplete : !vehicleId) {
      setSaveError(
        isNonClient
          ? "Name, last name, phone, and vehicle (year, make, model) are required for non-client estimates."
          : "Vehicle Year, Make, and Model are required. Please select a vehicle."
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSendError(null);
    try {
      const payload: Parameters<typeof updateEstimate>[1] = {
        customerNotes: customerNotes.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        items: items.length > 0 ? items : undefined,
      };
      if (isNonClient) {
        payload.nonClient = {
          name: nonClientName.trim(),
          lastName: nonClientLastName.trim(),
          phone: nonClientPhone.trim(),
          email: nonClientEmail.trim() || undefined,
          vehicle: {
            year: Number(nonClientYear),
            make: nonClientMake.trim(),
            model: nonClientModel.trim(),
          },
        };
        payload.vehicleId = null;
      } else {
        payload.vehicleId = vehicleId && vehicleId !== "" ? vehicleId : null;
      }
      await updateEstimate(id, payload);
      /* id="f1-refetch-after-save" - keep customer display stable, avoid "Customer—" after save */
      const fresh = await fetchEstimate(id);
      const freshIsNonClient = (fresh as any)?.kind === "non_client";
      const freshNc = fresh.nonClient;
      setEstimate(fresh);
      setCustomerNotes(fresh.customerNotes ?? "");
      setInternalNotes(fresh.internalNotes ?? "");
      setVehicleId(resolveVehicleId(fresh) ?? null);
      if (freshIsNonClient && freshNc) {
        setNonClientName(freshNc.name ?? "");
        setNonClientLastName(freshNc.lastName ?? "");
        setNonClientPhone(freshNc.phone ?? "");
        setNonClientEmail(freshNc.email ?? "");
        setNonClientYear(freshNc.vehicle?.year != null ? String(freshNc.vehicle.year) : "");
        setNonClientMake(freshNc.vehicle?.make ?? "");
        setNonClientModel(freshNc.vehicle?.model ?? "");
      }
      const freshItems = Array.isArray(fresh.items) ? [...fresh.items] : [];
      setItems(freshItems);
      setRawQuantities(freshItems.map((it) => (it.quantity == null || it.quantity === 0 ? "" : String(it.quantity))));
      setRawUnitPrices(freshItems.map((it) => (it.unitPrice == null || it.unitPrice === 0 ? "" : String(it.unitPrice))));
      const ncForRef =
        freshIsNonClient && freshNc
          ? {
              name: freshNc.name ?? "",
              lastName: freshNc.lastName ?? "",
              phone: freshNc.phone ?? "",
              email: freshNc.email ?? "",
              vehicle: {
                year: freshNc.vehicle?.year != null ? String(freshNc.vehicle.year) : "",
                make: freshNc.vehicle?.make ?? "",
                model: freshNc.vehicle?.model ?? "",
              },
            }
          : { name: "", lastName: "", phone: "", email: "", vehicle: { year: "", make: "", model: "" } };
      initialRef.current = JSON.stringify({
        customerNotes: fresh.customerNotes ?? "",
        internalNotes: fresh.internalNotes ?? "",
        vehicleId: resolveVehicleId(fresh) ?? null,
        nonClient: ncForRef,
        items: fresh.items ?? [],
      });
      setDirty(false);
    } catch (err) {
      const httpErr = err as HttpError;
      let apiMessage: string | undefined;
      if (
        httpErr?.data &&
        typeof httpErr.data === "object" &&
        "message" in httpErr.data &&
        typeof (httpErr.data as any).message === "string"
      ) {
        apiMessage = (httpErr.data as any).message;
      }
      setSaveError(apiMessage ?? httpErr.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!id || estimate?.status !== "draft") return;
    if (dirty) {
      setSendError("You must save before sending.");
      return;
    }
    const hasBlankDescription = items.some((it) => String(it?.description ?? "").trim().length === 0);
    if (hasBlankDescription) {
      setSendError("Add a description to each line item before sending.");
      return;
    }
    setSending(true);
    setSendError(null);
    setSaveError(null);
    try {
      const updated = await sendEstimate(id);
      const updatedIsNonClient = (updated as any)?.kind === "non_client";
      const updatedNc = updated.nonClient;
      setEstimate(updated);
      setCustomerNotes(updated.customerNotes ?? "");
      setInternalNotes(updated.internalNotes ?? "");
      setVehicleId(resolveVehicleId(updated) ?? null);
      if (updatedIsNonClient && updatedNc) {
        setNonClientName(updatedNc.name ?? "");
        setNonClientLastName(updatedNc.lastName ?? "");
        setNonClientPhone(updatedNc.phone ?? "");
        setNonClientEmail(updatedNc.email ?? "");
        setNonClientYear(updatedNc.vehicle?.year != null ? String(updatedNc.vehicle.year) : "");
        setNonClientMake(updatedNc.vehicle?.make ?? "");
        setNonClientModel(updatedNc.vehicle?.model ?? "");
      }
      const updatedItems = Array.isArray(updated.items) ? [...updated.items] : [];
      setItems(updatedItems);
      setRawQuantities(updatedItems.map((it) => (it.quantity == null || it.quantity === 0 ? "" : String(it.quantity))));
      setRawUnitPrices(updatedItems.map((it) => (it.unitPrice == null || it.unitPrice === 0 ? "" : String(it.unitPrice))));
      const ncForRef =
        updatedIsNonClient && updatedNc
          ? {
              name: updatedNc.name ?? "",
              lastName: updatedNc.lastName ?? "",
              phone: updatedNc.phone ?? "",
              email: updatedNc.email ?? "",
              vehicle: {
                year: updatedNc.vehicle?.year != null ? String(updatedNc.vehicle.year) : "",
                make: updatedNc.vehicle?.make ?? "",
                model: updatedNc.vehicle?.model ?? "",
              },
            }
          : { name: "", lastName: "", phone: "", email: "", vehicle: { year: "", make: "", model: "" } };
      initialRef.current = JSON.stringify({
        customerNotes: updated.customerNotes ?? "",
        internalNotes: updated.internalNotes ?? "",
        vehicleId: resolveVehicleId(updated) ?? null,
        nonClient: ncForRef,
        items: updated.items ?? [],
      });
      setDirty(false);
    } catch (err) {
      const httpErr = err as HttpError;
      const serverMessage =
        httpErr?.data &&
        typeof httpErr.data === "object" &&
        "message" in httpErr.data &&
        typeof (httpErr.data as { message?: unknown }).message === "string"
          ? (httpErr.data as { message: string }).message
          : undefined;
      setSendError(serverMessage || (httpErr as Error).message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (!id || estimate?.status !== "sent") return;
    setResending(true);
    setResendError(null);
    setSendError(null);
    try {
      const updated = await resendEstimate(id);
      const updatedIsNonClient = (updated as any)?.kind === "non_client";
      const updatedNc = updated.nonClient;
      setEstimate(updated);
      setCustomerNotes(updated.customerNotes ?? "");
      setInternalNotes(updated.internalNotes ?? "");
      setVehicleId(resolveVehicleId(updated) ?? null);
      if (updatedIsNonClient && updatedNc) {
        setNonClientName(updatedNc.name ?? "");
        setNonClientLastName(updatedNc.lastName ?? "");
        setNonClientPhone(updatedNc.phone ?? "");
        setNonClientEmail(updatedNc.email ?? "");
        setNonClientYear(updatedNc.vehicle?.year != null ? String(updatedNc.vehicle.year) : "");
        setNonClientMake(updatedNc.vehicle?.make ?? "");
        setNonClientModel(updatedNc.vehicle?.model ?? "");
      }
      const updatedItems = Array.isArray(updated.items) ? [...updated.items] : [];
      setItems(updatedItems);
      setRawQuantities(updatedItems.map((it) => (it.quantity == null || it.quantity === 0 ? "" : String(it.quantity))));
      setRawUnitPrices(updatedItems.map((it) => (it.unitPrice == null || it.unitPrice === 0 ? "" : String(it.unitPrice))));
      const ncForRef =
        updatedIsNonClient && updatedNc
          ? {
              name: updatedNc.name ?? "",
              lastName: updatedNc.lastName ?? "",
              phone: updatedNc.phone ?? "",
              email: updatedNc.email ?? "",
              vehicle: {
                year: updatedNc.vehicle?.year != null ? String(updatedNc.vehicle.year) : "",
                make: updatedNc.vehicle?.make ?? "",
                model: updatedNc.vehicle?.model ?? "",
              },
            }
          : { name: "", lastName: "", phone: "", email: "", vehicle: { year: "", make: "", model: "" } };
      initialRef.current = JSON.stringify({
        customerNotes: updated.customerNotes ?? "",
        internalNotes: updated.internalNotes ?? "",
        vehicleId: resolveVehicleId(updated) ?? null,
        nonClient: ncForRef,
        items: updated.items ?? [],
      });
      setDirty(false);
    } catch (err) {
      const httpErr = err as HttpError;
      let apiMessage: string | undefined;
      if (
        httpErr?.data &&
        typeof httpErr.data === "object" &&
        "message" in httpErr.data &&
        typeof (httpErr.data as any).message === "string"
      ) {
        apiMessage = (httpErr.data as any).message;
      }
      setResendError(apiMessage ?? httpErr.message ?? "Something went wrong.");
    } finally {
      setResending(false);
    }
  };

  const handleApprove = async () => {
    if (!id || (estimate?.status !== "sent" && estimate?.status !== "accepted")) return;
    setApproving(true);
    setApproveError(null);
    setApproveSuccess(null);
    try {
      const { estimate: updated } = await approveEstimate(id);
      setEstimate(updated);
      setApproveSuccess("Estimate approved.");
    } catch (err) {
      const httpErr = err as HttpError;
      const apiMessage =
        httpErr?.data &&
        typeof httpErr.data === "object" &&
        "message" in httpErr.data &&
        typeof (httpErr.data as { message?: unknown }).message === "string"
          ? (httpErr.data as { message: string }).message
          : undefined;
      setApproveError(apiMessage ?? (httpErr as Error).message ?? "Failed to approve.");
    } finally {
      setApproving(false);
    }
  };

  const handleConvert = async () => {
    if (!id) return;
    setConverting(true);
    setConvertError(null);
    try {
      const { workOrder } = await convertEstimateToWorkOrder(id);
      const woId = workOrder?._id != null ? String(workOrder._id) : null;
      if (woId) {
        navigate(`/work-orders/${woId}`);
      } else {
        setConvertError("Conversion succeeded but work order ID missing.");
      }
    } catch (err) {
      const httpErr = err as HttpError;
      const apiMessage =
        httpErr?.data &&
        typeof httpErr.data === "object" &&
        "message" in httpErr.data &&
        typeof (httpErr.data as { message?: unknown }).message === "string"
          ? (httpErr.data as { message: string }).message
          : undefined;
      setConvertError(apiMessage ?? (httpErr as Error).message ?? "Failed to convert.");
    } finally {
      setConverting(false);
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof EstimateLineItem,
    value: string | number
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === "type") {
        item.type = value as "labour" | "part" | "service";
      } else if (field === "unitPrice") {
        item.unitPrice = Number(value) || 0;
      } else {
        (item as any)[field] = value;
      }
      const qty = item.quantity ?? 0;
      const price = item.unitPrice ?? 0;
      item.lineTotal = qty * price;
      next[index] = item;
      return next;
    });
  };

  const handleRawQuantityChange = (index: number, raw: string) => {
    setRawQuantities((prev) => {
      const next = [...prev];
      next[index] = raw;
      return next;
    });
    const item = items[index];
    const qty =
      item?.type === "labour"
        ? parseQuantityInput(raw)
        : Number((raw || "").replace(/[^0-9.]/g, "")) || 0;
    handleItemChange(index, "quantity", Math.max(0, Math.round(qty * 100) / 100));
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        type: "service" as const,
        description: "",
        quantity: 0,
        unitPrice: 0,
        lineTotal: 0,
      },
    ]);
    setRawQuantities((prev) => [...prev, ""]);
    setRawUnitPrices((prev) => [...prev, ""]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setRawQuantities((prev) => prev.filter((_, i) => i !== index));
    setRawUnitPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUnitPriceChange = (index: number, raw: string) => {
    setRawUnitPrices((prev) => {
      const next = [...prev];
      next[index] = raw;
      return next;
    });
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const parsed = Number(cleaned) || 0;
    handleItemChange(index, "unitPrice", parsed);
  };

  if (loading) return <p>Loading estimate…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!estimate) return <p>Estimate not found.</p>;

  const customer =
    (estimate as any)?.kind === "non_client"
      ? (estimate.nonClient?.name ?? "—")
      : estimate.customerId && typeof estimate.customerId === "object"
        ? `${(estimate.customerId as any).firstName ?? ""} ${(estimate.customerId as any).lastName ?? ""}`.trim()
        : "—";

  const subtotal = items.reduce((sum, it) => sum + (it.lineTotal ?? 0), 0);
  const taxRate = estimate.taxRate ?? 13;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const isDraft = estimate.status === "draft";
  const isSent = estimate.status === "sent";
  const isAccepted = estimate.status === "accepted";
  const canApprove = isSent || isAccepted;
  const isApprovedOrPartially =
    estimate.status === "approved" || estimate.status === "partially_approved";
  const convertedWoId = (() => {
    const raw = estimate.convertedToWorkOrderId;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    return (raw as { _id?: string })?._id ?? null;
  })();

  return (
    <div style={{ padding: "2rem", maxWidth: "960px" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/estimates">&larr; Back to Estimates</Link>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0, color: "#ffffff" }}>
          Estimate {estimate.estimateNumber}
        </h2>
        {isDraft && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                !dirty ||
                saving ||
                (isNonClient ? !nonClientComplete : !vehicleId)
              }
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                background:
                  dirty &&
                  !saving &&
                  (isNonClient ? nonClientComplete : !!vehicleId)
                    ? "#2563eb"
                    : "#4b5563",
                color: "#fff",
                fontWeight: 500,
                cursor:
                  dirty &&
                  !saving &&
                  (isNonClient ? nonClientComplete : !!vehicleId)
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || dirty || saving}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #059669",
                background: sending ? "#4b5563" : "#059669",
                color: "#fff",
                fontWeight: 500,
                cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending…" : "Send Estimate"}
            </button>
          </div>
        )}
        {/* id="f2-sent-ui-resend-pdf" - sent action buttons */}
        {canApprove && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {isSent && (
              <>
                <button
                  type="button"
                  disabled={loadingPdf}
                  onClick={async () => {
                    if (!id) return;
                    try {
                      setLoadingPdf(true);
                      const blob = await httpBlob(`/estimates/${id}/pdf`);
                      const blobUrl = URL.createObjectURL(blob);
                      window.open(blobUrl, "_blank", "noopener,noreferrer");
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                    } catch (err) {
                      console.error("[EstimateDetail] PDF fetch failed:", err);
                    } finally {
                      setLoadingPdf(false);
                    }
                  }}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #2563eb",
                    background: loadingPdf ? "#4b5563" : "transparent",
                    color: "#2563eb",
                    fontWeight: 500,
                    cursor: loadingPdf ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingPdf ? "Loading PDF…" : "View PDF"}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #059669",
                    background: resending ? "#4b5563" : "#059669",
                    color: "#fff",
                    fontWeight: 500,
                    cursor: resending ? "not-allowed" : "pointer",
                  }}
                >
                  {resending ? "Resending…" : "Resend email"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #16a34a",
                background: approving ? "#4b5563" : "#16a34a",
                color: "#fff",
                fontWeight: 500,
                cursor: approving ? "not-allowed" : "pointer",
              }}
            >
              {approving ? "Approving…" : "Approve"}
            </button>
          </div>
        )}
        {isApprovedOrPartially && !convertedWoId && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #2563eb",
                background: converting ? "#4b5563" : "#2563eb",
                color: "#fff",
                fontWeight: 500,
                cursor: converting ? "not-allowed" : "pointer",
              }}
            >
              {converting ? "Converting…" : "Convert to Work Order"}
            </button>
          </div>
        )}
        {convertedWoId && (
          <Link
            to={`/work-orders/${convertedWoId}`}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #2563eb",
              background: "transparent",
              color: "#2563eb",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            View Work Order
          </Link>
        )}
      </div>

      {/* id="f2-sent-ui-resend-pdf" - sent metadata (Issued, Email sent, attempts, etc.) */}
      {isSent && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem 2rem",
            marginBottom: "1rem",
            padding: "0.75rem",
            borderRadius: "4px",
            border: "1px solid #374151",
            background: "#0f172a",
          }}
        >
          {(estimate as any).sentAt && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "0.25rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                Issued
              </div>
              <div style={{ color: "#e5e7eb" }}>
                {new Date((estimate as any).sentAt).toLocaleString()}
              </div>
            </div>
          )}
          {(estimate as any).emailSentAt && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "0.25rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                Email sent
              </div>
              <div style={{ color: "#e5e7eb" }}>
                {new Date((estimate as any).emailSentAt).toLocaleString()}
              </div>
            </div>
          )}
          {(estimate as any).emailAttemptCount != null && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "0.25rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                Email attempts
              </div>
              <div style={{ color: "#e5e7eb" }}>{(estimate as any).emailAttemptCount}</div>
            </div>
          )}
          {(estimate as any).emailLastAttemptAt && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "0.25rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                Last attempt
              </div>
              <div style={{ color: "#e5e7eb" }}>
                {new Date((estimate as any).emailLastAttemptAt).toLocaleString()}
              </div>
            </div>
          )}
          {(estimate as any).emailLastError && (
            <div style={{ flexBasis: "100%" }}>
              <div style={{ fontWeight: 500, marginBottom: "0.25rem", fontSize: "0.85rem", color: "#f59e0b" }}>
                Last email error
              </div>
              <div style={{ color: "#f59e0b" }}>{(estimate as any).emailLastError}</div>
            </div>
          )}
        </div>
      )}

      {(saveError || sendError || resendError || approveError || convertError) && (
        <p style={{ color: "red", marginBottom: "1rem" }}>
          {saveError ?? sendError ?? resendError ?? approveError ?? convertError}
        </p>
      )}
      {approveSuccess && (
        <p style={{ color: "#22c55e", marginBottom: "1rem", fontSize: "0.9rem" }}>
          {approveSuccess}
        </p>
      )}

      <div style={{ marginTop: "0.75rem" }}>
        <p style={{ marginBottom: "0.5rem" }}>Customer: {customer || "—"}</p>
        <p>Status: {estimate.status}</p>
      </div>

      {isDraft ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Customer notes (visible to customer)
            </label>
            <textarea
              aria-label="Customer notes (visible to customer)"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                maxWidth: "480px",
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid #4b5563",
                background: "#0f172a",
                color: "#e5e7eb",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Internal notes (internal only)
            </label>
            <textarea
              aria-label="Internal notes (internal only)"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                maxWidth: "480px",
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid #4b5563",
                background: "#0f172a",
                color: "#e5e7eb",
              }}
            />
          </div>
          {isNonClient && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "1rem",
                border: "1px solid #4b5563",
                borderRadius: "4px",
                background: "#0f172a",
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>
                Non-Client Info
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ minWidth: "160px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Name
                  </label>
                  <input
                    type="text"
                    aria-label="Non-client name"
                    value={nonClientName}
                    onChange={(e) => setNonClientName(e.target.value)}
                    placeholder="Name"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
                <div style={{ minWidth: "160px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Last name
                  </label>
                  <input
                    type="text"
                    aria-label="Non-client last name"
                    value={nonClientLastName}
                    onChange={(e) => setNonClientLastName(e.target.value)}
                    placeholder="Last name"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
                <div style={{ minWidth: "160px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-label="Non-client phone"
                    value={nonClientPhone}
                    onChange={(e) => setNonClientPhone(sanitizePhoneInput(e.target.value))}
                    placeholder="Phone"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
                <div style={{ minWidth: "200px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    aria-label="Non-client email"
                    value={nonClientEmail}
                    onChange={(e) => setNonClientEmail(e.target.value)}
                    placeholder="Email"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ minWidth: "80px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Year
                  </label>
                  <input
                    type="text"
                    aria-label="Vehicle year"
                    value={nonClientYear}
                    onChange={(e) => setNonClientYear(e.target.value)}
                    placeholder="Year"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
                <div style={{ minWidth: "140px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Make
                  </label>
                  <input
                    type="text"
                    aria-label="Vehicle make"
                    value={nonClientMake}
                    onChange={(e) => setNonClientMake(e.target.value)}
                    placeholder="Make"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
                <div style={{ minWidth: "140px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                    Model
                  </label>
                  <input
                    type="text"
                    aria-label="Vehicle model"
                    value={nonClientModel}
                    onChange={(e) => setNonClientModel(e.target.value)}
                    placeholder="Model"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #4b5563",
                      background: "#0f172a",
                      color: "#e5e7eb",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {!isNonClient && (
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
                Vehicle
              </label>
              <select
                aria-label="Vehicle"
                value={vehicleId ?? ""}
                onChange={(e) => setVehicleId(e.target.value === "" ? null : e.target.value)}
                disabled={vehiclesLoading}
                style={{
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #4b5563",
                  background: "#0f172a",
                  color: "#e5e7eb",
                  minWidth: "200px",
                }}
              >
                <option value="">No vehicle</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.year && `${v.year} `}{v.make} {v.model}
                    {v.licensePlate && ` (${v.licensePlate})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 500 }}>Line items</label>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.85rem",
                  border: "1px solid #4b5563",
                  borderRadius: "4px",
                  background: "transparent",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                + Add item
              </button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #374151" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Description</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Total</th>
                  <th style={{ width: "60px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "8px" }}>
                      <select
                        aria-label="Line item type"
                        value={item.type ?? "service"}
                        onChange={(e) => handleItemChange(idx, "type", e.target.value)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #4b5563",
                          background: "#0f172a",
                          color: "#e5e7eb",
                        }}
                      >
                        <option value="labour">Labour</option>
                        <option value="part">Part</option>
                        <option value="service">Service</option>
                      </select>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <input
                        type="text"
                        aria-label="Description"
                        value={item.description ?? ""}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        placeholder="Description"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #4b5563",
                          background: "#0f172a",
                          color: "#e5e7eb",
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="text"
                        aria-label="Quantity"
                        value={rawQuantities[idx] ?? ""}
                        onChange={(e) => handleRawQuantityChange(idx, e.target.value)}
                        placeholder={item.type === "labour" ? "e.g. 1:25" : "Qty"}
                        style={{
                          width: "80px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #4b5563",
                          background: "#0f172a",
                          color: "#e5e7eb",
                          textAlign: "right",
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <input
                        type="text"
                        aria-label="Unit price"
                        value={rawUnitPrices[idx] ?? ""}
                        onChange={(e) => handleUnitPriceChange(idx, e.target.value)}
                        placeholder="0.00"
                        style={{
                          width: "100px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #4b5563",
                          background: "#0f172a",
                          color: "#e5e7eb",
                          textAlign: "right",
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      {formatMoney(item.lineTotal ?? 0)}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
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
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                No line items. Click Add item to add one.
              </p>
            )}
            {items.length > 0 && (
              <div
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "4px",
                  fontSize: "0.9rem",
                }}
              >
                <div>Subtotal: {formatMoney(subtotal)}</div>
                <div>Tax ({taxRate}%): {formatMoney(taxAmount)}</div>
                <div style={{ fontWeight: 600 }}>Total: {formatMoney(total)}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
          {formatVehicleSummary(estimate.vehicleId) && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>Vehicle</div>
              <div style={{ color: "#e5e7eb" }}>{formatVehicleSummary(estimate.vehicleId)}</div>
            </div>
          )}

          {Array.isArray(estimate.items) && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Line items</div>
              {estimate.items.length > 0 ? (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #374151" }}>
                        <th style={{ textAlign: "left", padding: "8px" }}>Description</th>
                        <th style={{ textAlign: "right", padding: "8px" }}>Qty</th>
                        <th style={{ textAlign: "right", padding: "8px" }}>Unit Price</th>
                        <th style={{ textAlign: "right", padding: "8px" }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.items.map((item, idx) => {
                        const qty = item.quantity ?? 0;
                        const price = item.unitPrice ?? 0;
                        const lineTotal = Number((qty * price).toFixed(2));
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #1f2937" }}>
                            <td style={{ padding: "8px" }}>{item.description ?? "—"}</td>
                            <td style={{ padding: "8px", textAlign: "right" }}>{qty}</td>
                            <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(price)}</td>
                            <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(() => {
                    const readOnlySubtotal = estimate.items.reduce(
                      (sum, it) => sum + Number(((it.quantity ?? 0) * (it.unitPrice ?? 0)).toFixed(2)),
                      0
                    );
                    const readOnlyTaxRate = estimate.taxRate ?? 13;
                    const readOnlyTaxAmount = readOnlySubtotal * (readOnlyTaxRate / 100);
                    const readOnlyTotal = readOnlySubtotal + readOnlyTaxAmount;
                    return (
                      <div
                        style={{
                          marginTop: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "4px",
                          fontSize: "0.9rem",
                        }}
                      >
                        <div>Subtotal: {formatMoney(readOnlySubtotal)}</div>
                        <div>Tax ({readOnlyTaxRate}%): {formatMoney(readOnlyTaxAmount)}</div>
                        <div style={{ fontWeight: 600 }}>Total: {formatMoney(readOnlyTotal)}</div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>No line items.</p>
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <div>Subtotal: {formatMoney(0)}</div>
                    <div>Tax ({estimate.taxRate ?? 13}%): {formatMoney(0)}</div>
                    <div style={{ fontWeight: 600 }}>Total: {formatMoney(0)}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {(estimate.customerNotes || estimate.internalNotes) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {estimate.customerNotes && (
                <div>
                  <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>Customer notes</div>
                  <div style={{ color: "#e5e7eb" }}>{estimate.customerNotes}</div>
                </div>
              )}
              {estimate.internalNotes && (
                <div>
                  <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>Internal notes</div>
                  <div style={{ color: "#e5e7eb" }}>{estimate.internalNotes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

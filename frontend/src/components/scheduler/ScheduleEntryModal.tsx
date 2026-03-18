// frontend/src/components/scheduler/ScheduleEntryModal.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { ScheduleEntry, UnscheduledWorkOrder } from "../../api/scheduler";
import {
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
} from "../../api/scheduler";
import {
  toISODateLocal,
  toTimeStringLocal,
  parseDateAndTime,
} from "../../utils/dateTime";
import { getWorkOrderTitle } from "../../utils/workOrderDisplay";

/** Extract string ID from workOrderId (handles Mongoose populated object) */
function toWorkOrderIdString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "_id" in val) return String((val as { _id: unknown })._id);
  return "";
}

/** Safe local date/time for form inputs; falls back to now if invalid */
function safeToISODateLocal(d: Date): string {
  return Number.isNaN(d.getTime()) ? toISODateLocal(new Date()) : toISODateLocal(d);
}

function safeToTimeStringLocal(d: Date): string {
  return Number.isNaN(d.getTime()) ? toTimeStringLocal(new Date()) : toTimeStringLocal(d);
}

type Props = {
  open: boolean;
  mode: "create" | "edit" | "view";
  workOrder?: UnscheduledWorkOrder | null;
  entry?: ScheduleEntry | null;
  unscheduledWorkOrders?: UnscheduledWorkOrder[];
  initialDate?: Date;
  initialHour?: number;
  technicians: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
};

const MINUTES_OPTIONS = [0, 15, 30, 45] as const;
const MIN_DURATION = 15;
const MAX_DURATION = 1440;

function durationToHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.min(MAX_DURATION, Math.round(totalMinutes)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  const minutes = MINUTES_OPTIONS.reduce((a, b) =>
    Math.abs(remainder - a) < Math.abs(remainder - b) ? a : b
  );
  if (minutes === 0 && remainder >= 53) {
    return { hours: hours + 1, minutes: 0 };
  }
  return { hours, minutes };
}

function hoursMinutesToDuration(hours: number, minutes: number): number {
  return Math.max(0, hours) * 60 + minutes;
}

export default function ScheduleEntryModal({
  open,
  mode,
  workOrder,
  entry,
  unscheduledWorkOrders = [],
  initialDate,
  initialHour = 9,
  technicians,
  onClose,
  onSaved,
}: Props) {
  const isView = mode === "view";
  const isCreateFromSlot = mode === "create" && !workOrder;

  const [workOrderId, setWorkOrderId] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("09:00");
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutesM, setDurationMinutesM] = useState<number>(0);
  const [technicianId, setTechnicianId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ message: string; entryId: string }[]>([]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setWarnings([]);
    if (entry) {
      const start = new Date(entry.startAt);
      const duration = entry.durationMinutes ?? 60;
      const { hours, minutes } = durationToHoursMinutes(duration);
      setWorkOrderId(toWorkOrderIdString(entry.workOrderId));
      setDateStr(safeToISODateLocal(start));
      setTimeStr(safeToTimeStringLocal(start));
      setDurationHours(hours);
      setDurationMinutesM(minutes);
      setTechnicianId(toWorkOrderIdString(entry.technicianId));
      setNotes(entry.notes ?? "");
    } else if (workOrder) {
      setWorkOrderId(workOrder._id);
      setDateStr(initialDate ? toISODateLocal(initialDate) : toISODateLocal(new Date()));
      const d = initialDate ? new Date(initialDate) : new Date();
      d.setHours(initialHour, 0, 0, 0);
      setTimeStr(toTimeStringLocal(d));
      setDurationHours(1);
      setDurationMinutesM(0);
      setTechnicianId("");
      setNotes("");
    } else {
      setWorkOrderId(unscheduledWorkOrders[0]?._id ?? "");
      setDateStr(initialDate ? toISODateLocal(initialDate) : toISODateLocal(new Date()));
      const d = initialDate ? new Date(initialDate) : new Date();
      d.setHours(initialHour, 0, 0, 0);
      setTimeStr(toTimeStringLocal(d));
      setDurationHours(1);
      setDurationMinutesM(0);
      setTechnicianId("");
      setNotes("");
    }
  }, [open, entry, workOrder, unscheduledWorkOrders, initialDate, initialHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarnings([]);

    const durationMinutes = hoursMinutesToDuration(durationHours, durationMinutesM);
    if (durationMinutes === 0) {
      setError("Duration must be at least 15 minutes.");
      return;
    }
    if (durationMinutes < MIN_DURATION) {
      setError(`Duration must be at least ${MIN_DURATION} minutes.`);
      return;
    }
    if (durationMinutes > MAX_DURATION) {
      setError(`Duration cannot exceed ${MAX_DURATION} minutes (24 hours).`);
      return;
    }
    if (durationHours < 0) {
      setError("Hours cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      const startAt = parseDateAndTime(dateStr, timeStr).toISOString();
      if (mode === "create") {
        const woId = workOrder?._id ?? workOrderId ?? entry?.workOrderId;
        if (!woId) {
          setError("Work order is required.");
          return;
        }
        const res = await createScheduleEntry({
          workOrderId: woId,
          startAt,
          durationMinutes,
          technicianId: technicianId || undefined,
          notes: notes.trim() || undefined,
        });
        setWarnings(res.warnings ?? []);
        onSaved();
        onClose();
      } else if (entry) {
        const res = await updateScheduleEntry(entry._id, {
          startAt,
          durationMinutes,
          technicianId: technicianId || null,
          notes: notes.trim() || undefined,
        });
        setWarnings(res.warnings ?? []);
        onSaved();
        onClose();
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Failed to save.";
      const data = (err as { data?: { message?: string } })?.data;
      setError(data?.message ?? msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry || !confirm("Unschedule this work order? It will be marked as cancelled.")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteScheduleEntry(entry._id);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Failed to unschedule.";
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  const woForDisplay = entry?.workOrder ?? workOrder ?? (workOrderId ? unscheduledWorkOrders.find((w) => w._id === workOrderId) : null);
  const primaryTitle = woForDisplay ? getWorkOrderTitle(woForDisplay) : "";
  const secondaryLine = woForDisplay
    ? [woForDisplay.customerLabel, woForDisplay.vehicleLabel].filter(Boolean).join(" • ") || ""
    : "";
  const viewWorkOrderId = toWorkOrderIdString(entry?.workOrderId ?? workOrder?._id ?? workOrderId);

  const inputBase = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    fontSize: "0.9rem",
    borderRadius: "6px",
    border: "1px solid #475569",
    background: "#0f172a",
    color: "#e5e7eb",
    boxSizing: "border-box" as const,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "85vh",
          overflowY: "auto",
          borderRadius: "0.75rem",
          background: "#0b1220",
          border: "1px solid #1f2937",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
          padding: "1.25rem",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>
          {mode === "create" ? "Schedule Work Order" : mode === "edit" ? "Edit Schedule" : "Schedule Details"}
        </div>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #f87171",
              background: "rgba(248, 113, 113, 0.15)",
              color: "#fca5a5",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {warnings.length > 0 && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #fbbf24",
              background: "rgba(251, 191, 36, 0.15)",
              color: "#fde047",
              fontSize: "0.85rem",
            }}
          >
            {warnings.map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Work Order
            </label>
            {isCreateFromSlot ? (
              unscheduledWorkOrders.length > 0 ? (
                <select
                  value={workOrderId}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  required
                  style={inputBase}
                  aria-label="Work order"
                >
                  <option value="">Select work order…</option>
                  {unscheduledWorkOrders.map((wo) => (
                    <option key={wo._id} value={wo._id}>
                      {getWorkOrderTitle(wo).slice(0, 50)}
                      {(wo.customerLabel || wo.vehicleLabel) && ` • ${[wo.customerLabel, wo.vehicleLabel].filter(Boolean).join(" • ")}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ ...inputBase, color: "#94a3b8" }}>
                  No unscheduled work orders. Select one from the sidebar first.
                </div>
              )
            ) : (
              <div
                style={{
                  ...inputBase,
                  opacity: 0.9,
                  cursor: "default",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {woForDisplay ? (
                  <>
                    <div style={{ fontWeight: 600 }}>{primaryTitle}</div>
                    {secondaryLine && (
                      <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                        {secondaryLine}
                      </div>
                    )}
                    {(woForDisplay.diagnosis || woForDisplay.notes) && (
                      <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                        {woForDisplay.diagnosis && <div>{woForDisplay.diagnosis}</div>}
                        {woForDisplay.notes && <div>{woForDisplay.notes}</div>}
                      </div>
                    )}
                  </>
                ) : (
                  entry ? `WO ${toWorkOrderIdString(entry.workOrderId).slice(-8)}` : "—"
                )}
              </div>
            )}
            {viewWorkOrderId && (
              <Link
                to={`/work-orders/${viewWorkOrderId}`}
                style={{
                  display: "inline-block",
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#60a5fa",
                  textDecoration: "none",
                }}
              >
                View Work Order →
              </Link>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                Date
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                required
                disabled={isView}
                style={inputBase}
                aria-label="Date"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                Start Time
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                required
                disabled={isView}
                style={inputBase}
                aria-label="Start time"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                Duration (hours)
              </label>
              <input
                type="number"
                min={0}
                max={24}
                value={durationHours}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v) && v >= 0) setDurationHours(Math.min(24, v));
                  else if (e.target.value === "") setDurationHours(0);
                }}
                disabled={isView}
                style={inputBase}
                aria-label="Duration hours"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                Duration (minutes)
              </label>
              <select
                value={durationMinutesM}
                onChange={(e) => setDurationMinutesM(Number(e.target.value))}
                disabled={isView}
                style={inputBase}
                aria-label="Duration minutes"
              >
                {MINUTES_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Technician
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              disabled={isView}
              style={inputBase}
              aria-label="Technician"
            >
              <option value="">Unassigned</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isView}
              rows={2}
              style={{ ...inputBase, resize: "vertical" }}
              aria-label="Notes"
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            <div>
              {entry && !isView && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: "0.5rem 0.9rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #ef4444",
                    background: "transparent",
                    color: "#f87171",
                    fontSize: "0.9rem",
                    cursor: deleting ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting ? "Unscheduling…" : "Unschedule"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "0.5rem 0.9rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                {isView ? "Close" : "Cancel"}
              </button>
              {!isView && (
                <button
                  type="submit"
                  disabled={
                    saving ||
                    (isCreateFromSlot && (unscheduledWorkOrders.length === 0 || !workOrderId)) ||
                    hoursMinutesToDuration(durationHours, durationMinutesM) < MIN_DURATION ||
                    hoursMinutesToDuration(durationHours, durationMinutesM) > MAX_DURATION
                  }
                  style={{
                    padding: "0.5rem 0.9rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #2563eb",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

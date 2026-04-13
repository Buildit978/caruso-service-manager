// frontend/src/pages/SchedulerPage.tsx
import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMe } from "../auth/useMe";
import {
  fetchScheduleEntries,
  fetchUnscheduledWorkOrders,
  fetchScheduleEntryByWorkOrder,
} from "../api/scheduler";
import { fetchWorkOrder } from "../api/workOrders";
import { listUsers as listTeamUsers } from "../api/users";
import type { ScheduleEntry, UnscheduledWorkOrder } from "../api/scheduler";
import type { WorkOrder } from "../types/workOrder";
import { toISODate } from "../utils/dateTime";
import { getThisWeekRangeMondayBased } from "../utils/weekRange";
import { getWorkOrderTitle } from "../utils/workOrderDisplay";
import SchedulerToolbar from "../components/scheduler/SchedulerToolbar";
import SchedulerSidebar from "../components/scheduler/SchedulerSidebar";
import SchedulerGrid from "../components/scheduler/SchedulerGrid";
import SchedulerAgenda from "../components/scheduler/SchedulerAgenda";
import ScheduleEntryModal from "../components/scheduler/ScheduleEntryModal";
import type { HttpError } from "../api/http";

const MOBILE_BREAKPOINT = 768;

type ViewMode = "day" | "week";

/** Same-origin path only — avoids open redirects via returnTo */
function sanitizeInternalReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  const u = raw.trim();
  if (!u.startsWith("/") || u.startsWith("//")) return null;
  return u;
}

function toWorkOrderIdString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "_id" in val) return String((val as { _id: unknown })._id);
  return "";
}

function customerLabelFromWorkOrder(wo: WorkOrder): string {
  const customer =
    typeof wo.customerId === "object" && wo.customerId && "firstName" in wo.customerId
      ? wo.customerId
      : wo.customer ?? null;
  return (
    customer?.name ||
    customer?.fullName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "(No name)"
  );
}

function vehicleLabelFromWorkOrder(wo: WorkOrder): string | undefined {
  const v = wo.vehicle;
  if (!v) return undefined;
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function workOrderToUnscheduled(wo: WorkOrder): UnscheduledWorkOrder {
  return {
    _id: wo._id,
    status: wo.status,
    complaint: wo.complaint,
    diagnosis: wo.diagnosis,
    notes: wo.notes,
    customerLabel: customerLabelFromWorkOrder(wo),
    vehicleLabel: vehicleLabelFromWorkOrder(wo),
  };
}

export default function SchedulerPage() {
  const { me, loading: meLoading } = useMe();
  const canEdit = me?.role === "owner" || me?.role === "manager";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const deepLinkConsumedRef = useRef<string | null>(null);
  const pendingPostSaveRef = useRef<{
    workOrderId: string;
    returnTo: string | null;
    /** When true, navigate to returnTo only after a successful create from this flow */
    returnAfterCreateOnly: boolean;
  } | null>(null);

  const [schedulingBanner, setSchedulingBanner] = useState<{
    workOrderId: string;
    title: string;
    returnTo: string | null;
    mode: "create" | "edit";
  } | null>(null);
  /** Create-from–work-order: calendar slot supplies start time; modal confirms details */
  const [calendarAnchorWorkOrder, setCalendarAnchorWorkOrder] = useState<UnscheduledWorkOrder | null>(null);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  const [viewDate, setViewDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [technicianId, setTechnicianId] = useState("");
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [unscheduledWorkOrders, setUnscheduledWorkOrders] = useState<UnscheduledWorkOrder[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [debouncedSidebarSearch, setDebouncedSidebarSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [modalWorkOrder, setModalWorkOrder] = useState<UnscheduledWorkOrder | null>(null);
  const [modalEntry, setModalEntry] = useState<ScheduleEntry | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>();
  const [modalInitialHour, setModalInitialHour] = useState<number>(9);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isMobile) setViewMode("day");
  }, [isMobile]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSidebarSearch(sidebarSearch), 250);
    return () => clearTimeout(t);
  }, [sidebarSearch]);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (viewMode === "day") {
      const d = new Date(viewDate);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return { start: d, end };
    }
    return getThisWeekRangeMondayBased(viewDate);
  }, [viewDate, viewMode]);

  const startStr = toISODate(rangeStart);
  const endStr = toISODate(rangeEnd);

  const workOrderIdParam = searchParams.get("workOrderId");
  const returnToParam = searchParams.get("returnTo");
  const editParam = searchParams.get("edit");

  useEffect(() => {
    if (!workOrderIdParam) {
      deepLinkConsumedRef.current = null;
      return;
    }
    if (meLoading || !canEdit) return;
    const workOrderId = workOrderIdParam;

    const lockKey = `${workOrderId}:${editParam ?? ""}`;
    if (deepLinkConsumedRef.current === lockKey) return;
    deepLinkConsumedRef.current = lockKey;

    const wantsEdit = editParam === "1";
    const safeReturnTo = sanitizeInternalReturnTo(returnToParam);

    // Set immediately for create-from–work-order so React Strict Mode effect cleanup
    // (cancelled before await finishes) cannot skip this and break post-save return.
    if (!wantsEdit) {
      pendingPostSaveRef.current = {
        workOrderId,
        returnTo: safeReturnTo,
        returnAfterCreateOnly: true,
      };
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("workOrderId");
        next.delete("returnTo");
        next.delete("edit");
        return next;
      },
      { replace: true }
    );

    let cancelled = false;

    async function run() {
      setDeepLinkError(null);
      try {
        if (wantsEdit) {
          const entry = await fetchScheduleEntryByWorkOrder(workOrderId);
          if (cancelled) return;
          if (entry) {
            pendingPostSaveRef.current = {
              workOrderId,
              returnTo: safeReturnTo,
              returnAfterCreateOnly: false,
            };
            const title = getWorkOrderTitle(entry.workOrder ?? {});
            setSchedulingBanner({ workOrderId, title, returnTo: safeReturnTo, mode: "edit" });
            setCalendarAnchorWorkOrder(null);
            setHighlightEntryId(entry._id);
            const start = new Date(entry.startAt);
            if (!Number.isNaN(start.getTime())) setViewDate(start);
            setModalOpen(false);
            return;
          }
          // edit=1 but no active entry: fall through to create; establish return target now
          pendingPostSaveRef.current = {
            workOrderId,
            returnTo: safeReturnTo,
            returnAfterCreateOnly: true,
          };
        }

        const wo = await fetchWorkOrder(workOrderId);
        if (cancelled) return;
        const u = workOrderToUnscheduled(wo);
        setSchedulingBanner({
          workOrderId,
          title: getWorkOrderTitle(u),
          returnTo: safeReturnTo,
          mode: "create",
        });
        setCalendarAnchorWorkOrder(u);
        setHighlightEntryId(null);
        setModalOpen(false);
      } catch (e) {
        if (!cancelled) {
          console.error("[SchedulerPage] work order deep link failed", e);
          setDeepLinkError(
            "Could not load that work order for scheduling. Use the sidebar or open it from Work Orders."
          );
          pendingPostSaveRef.current = null;
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [workOrderIdParam, returnToParam, editParam, meLoading, canEdit, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadTechnicians() {
      if (me?.role === "technician") {
        setTechnicians([{ id: me.id, name: me.displayName || me.name || "My schedule" }]);
        return;
      }
      try {
        const res = await listTeamUsers();
        if (cancelled) return;
        const techs = (res.users ?? [])
          .filter((u) => u.role === "technician" && u.isActive)
          .map((u) => ({
            id: u.id,
            name: u.name || u.email || u.id,
          }));
        setTechnicians(techs);
      } catch (err) {
        if ((err as HttpError)?.status === 403) {
          setTechnicians([]);
        }
      }
    }
    if (me) loadTechnicians();
    return () => { cancelled = true; };
  }, [me]);

  useEffect(() => {
    let cancelled = false;
    async function loadEntries() {
      setEntriesLoading(true);
      try {
        const data = await fetchScheduleEntries({
          start: startStr,
          end: endStr,
          technicianId: technicianId || undefined,
        });
        if (!cancelled) setEntries(data);
      } catch (err) {
        console.error("[SchedulerPage] fetch entries error", err);
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    }
    loadEntries();
    return () => { cancelled = true; };
  }, [startStr, endStr, technicianId]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnscheduled() {
      setSidebarLoading(true);
      try {
        const data = await fetchUnscheduledWorkOrders({
          search: debouncedSidebarSearch || undefined,
          limit: 50,
        });
        if (!cancelled) setUnscheduledWorkOrders(data);
      } catch (err) {
        console.error("[SchedulerPage] fetch unscheduled error", err);
        if (!cancelled) setUnscheduledWorkOrders([]);
      } finally {
        if (!cancelled) setSidebarLoading(false);
      }
    }
    loadUnscheduled();
    return () => { cancelled = true; };
  }, [debouncedSidebarSearch]);

  const handleSlotClick = (date: Date, hour: number) => {
    if (!canEdit) return;
    const pending = pendingPostSaveRef.current;
    const anchor = calendarAnchorWorkOrder;
    if (
      anchor &&
      pending &&
      String(pending.workOrderId) === String(anchor._id) &&
      schedulingBanner?.mode === "create"
    ) {
      setModalMode("create");
      setModalWorkOrder(anchor);
      setModalEntry(null);
      setModalInitialDate(date);
      setModalInitialHour(hour);
      setModalOpen(true);
      return;
    }
    setModalMode("create");
    setModalWorkOrder(null);
    setModalEntry(null);
    setModalInitialDate(date);
    setModalInitialHour(hour);
    setModalOpen(true);
  };

  const handleEntryClick = (entry: ScheduleEntry) => {
    setModalMode(canEdit ? "edit" : "view");
    setModalWorkOrder(null);
    setModalEntry(entry);
    setModalInitialDate(undefined);
    setModalInitialHour(9);
    setModalOpen(true);
  };

  const clearWorkOrderDeepLinkContext = () => {
    pendingPostSaveRef.current = null;
    setSchedulingBanner(null);
    setCalendarAnchorWorkOrder(null);
    setHighlightEntryId(null);
  };

  const handleSelectWorkOrder = (wo: UnscheduledWorkOrder) => {
    const pending = pendingPostSaveRef.current;
    if (pending && String(wo._id) !== String(pending.workOrderId)) {
      clearWorkOrderDeepLinkContext();
    }
    setModalMode("create");
    setModalWorkOrder(wo);
    setModalEntry(null);
    setModalInitialDate(viewDate);
    setModalInitialHour(9);
    setModalOpen(true);
  };

  const handleMobileAddClick = () => {
    if (!canEdit) return;
    const pending = pendingPostSaveRef.current;
    const anchor = calendarAnchorWorkOrder;
    if (
      anchor &&
      pending &&
      String(pending.workOrderId) === String(anchor._id) &&
      schedulingBanner?.mode === "create"
    ) {
      setModalMode("create");
      setModalWorkOrder(anchor);
      setModalEntry(null);
      setModalInitialDate(viewDate);
      setModalInitialHour(9);
      setModalOpen(true);
      return;
    }
    setModalMode("create");
    setModalWorkOrder(null);
    setModalEntry(null);
    setModalInitialDate(viewDate);
    setModalInitialHour(9);
    setModalOpen(true);
  };

  const handleModalSaved = (meta?: { kind: "create" | "update" | "delete"; workOrderId?: string }) => {
    const pending = pendingPostSaveRef.current;
    const woFromModal =
      modalWorkOrder?._id ?? (modalEntry ? toWorkOrderIdString(modalEntry.workOrderId) : null);
    const woForReturnMatch =
      meta?.kind === "create" && meta.workOrderId
        ? String(meta.workOrderId)
        : woFromModal
          ? String(woFromModal)
          : null;
    const matched =
      pending && woForReturnMatch && String(pending.workOrderId) === woForReturnMatch;
    const shouldReturnToWorkOrder =
      matched &&
      pending.returnAfterCreateOnly &&
      meta?.kind === "create" &&
      pending.returnTo;
    const returnPath = shouldReturnToWorkOrder ? sanitizeInternalReturnTo(pending.returnTo) : null;

    if (returnPath) {
      clearWorkOrderDeepLinkContext();
      navigate(returnPath);
      return;
    }

    setEntriesLoading(true);
    setSidebarLoading(true);
    void (async () => {
      try {
        const [nextEntries, nextUnscheduled] = await Promise.all([
          fetchScheduleEntries({
            start: startStr,
            end: endStr,
            technicianId: technicianId || undefined,
          }),
          fetchUnscheduledWorkOrders({
            search: debouncedSidebarSearch || undefined,
            limit: 50,
          }),
        ]);
        setEntries(nextEntries);
        setUnscheduledWorkOrders(nextUnscheduled);
      } finally {
        setEntriesLoading(false);
        setSidebarLoading(false);
      }
    })();
  };

  if (meLoading) {
    return (
      <div style={{ padding: "1rem", color: "#94a3b8" }}>Loading…</div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: isMobile ? undefined : "calc(100vh - 60px)",
        minHeight: isMobile ? "100vh" : 0,
        background: "#020617",
        overflowY: isMobile ? "visible" : undefined,
      }}
    >
      <div style={{ padding: "0 1rem", borderBottom: "1px solid #1f2937", flexShrink: 0 }}>
        <h1 style={{ margin: 0, padding: "1rem 0 0", fontSize: "1.25rem", fontWeight: 600, color: "#e5e7eb" }}>
          Scheduler
        </h1>
        {schedulingBanner && (
          <div
            style={{
              marginTop: "0.5rem",
              marginBottom: "0.35rem",
              padding: "0.65rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid #2563eb",
              background: "rgba(37, 99, 235, 0.12)",
              color: "#e5e7eb",
              fontSize: "0.875rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div>
                <strong>{schedulingBanner.mode === "edit" ? "Edit on calendar" : "Schedule on calendar"}</strong>
                {": "}
                <span style={{ color: "#93c5fd" }}>{schedulingBanner.title}</span>
                {schedulingBanner.returnTo && (
                  <>
                    {" · "}
                    <Link to={schedulingBanner.returnTo} style={{ color: "#93c5fd" }}>
                      Back to work order
                    </Link>
                  </>
                )}
              </div>
              <div style={{ marginTop: "0.35rem", color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1.4 }}>
                {schedulingBanner.mode === "create" ? (
                  <>
                    Click an <strong style={{ color: "#e5e7eb" }}>empty time slot</strong> on the calendar to set
                    the start time. Technician and duration are set in the form.
                  </>
                ) : (
                  <>
                    Tap the <strong style={{ color: "#e5e7eb" }}>highlighted appointment</strong> on the calendar
                    to change time, technician, or notes.
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearWorkOrderDeepLinkContext}
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "6px",
                border: "1px solid #475569",
                background: "transparent",
                color: "#cbd5e1",
                fontSize: "0.8rem",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        {deepLinkError && (
          <div style={{ color: "#fca5a5", marginTop: "0.35rem", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
            {deepLinkError}
          </div>
        )}
        <SchedulerToolbar
          viewDate={viewDate}
          viewMode={viewMode}
          technicianId={technicianId}
          technicians={technicians}
          onViewDateChange={setViewDate}
          onViewModeChange={setViewMode}
          onTechnicianChange={setTechnicianId}
          hideViewToggle={isMobile}
          isMobile={isMobile}
        />
      </div>
      <div
        style={{
          display: "flex",
          flex: isMobile ? undefined : 1,
          minHeight: isMobile ? undefined : 0,
          flexDirection: isMobile ? "column" : "row",
          overflow: isMobile ? "visible" : undefined,
        }}
      >
        <SchedulerSidebar
          workOrders={unscheduledWorkOrders}
          loading={sidebarLoading}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
          onSelectWorkOrder={handleSelectWorkOrder}
          canEdit={canEdit}
          compact={isMobile}
          isMobile={isMobile}
          highlightWorkOrderId={
            schedulingBanner?.mode === "create" ? schedulingBanner.workOrderId : null
          }
        />
        <div
          style={{
            flex: isMobile ? undefined : 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: isMobile ? undefined : 0,
            padding: isMobile ? "0.75rem" : "1rem",
          }}
        >
          {entriesLoading ? (
            <p style={{ color: "#94a3b8" }}>Loading schedule…</p>
          ) : isMobile ? (
            <SchedulerAgenda
              entries={entries}
              viewDate={viewDate}
              canEdit={canEdit}
              onEntryClick={handleEntryClick}
              onAddClick={handleMobileAddClick}
              isMobile={true}
              highlightEntryId={highlightEntryId}
            />
          ) : (
            <SchedulerGrid
              entries={entries}
              viewDate={viewDate}
              viewMode={viewMode}
              canEdit={canEdit}
              onSlotClick={handleSlotClick}
              onEntryClick={handleEntryClick}
              highlightEntryId={highlightEntryId}
            />
          )}
        </div>
      </div>
      <ScheduleEntryModal
        open={modalOpen}
        mode={modalMode}
        workOrder={modalWorkOrder}
        entry={modalEntry}
        unscheduledWorkOrders={unscheduledWorkOrders}
        initialDate={modalInitialDate}
        initialHour={modalInitialHour}
        technicians={technicians}
        onClose={() => setModalOpen(false)}
        onSaved={handleModalSaved}
      />
    </div>
  );
}

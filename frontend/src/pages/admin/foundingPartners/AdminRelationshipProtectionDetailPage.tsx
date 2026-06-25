import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  approveRelationshipProtection,
  declineRelationshipProtection,
  fetchRelationshipProtectionById,
  releaseRelationshipProtection,
  updateRelationshipProtection,
  type RelationshipProtectionDetail,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import CommunicationNotesSection from "./CommunicationNotesSection";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { ProtectionStatusBadge, LifecycleStatusBadge, getNextLifecycleStatus, getLifecycleLabel } from "./foundingPartnerBadges";
import { FP_MODULE_TITLE, formatDateTime, toDatetimeLocalValue, fromDatetimeLocalValue, apiErrorMessage } from "./foundingPartnerFormat";

export default function AdminRelationshipProtectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [protection, setProtection] = useState<RelationshipProtectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ introducedAt: "", evidenceSummary: "" });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRelationshipProtectionById(id);
      setProtection(data);
      setEditForm({
        introducedAt: toDatetimeLocalValue(data.introducedAt),
        evidenceSummary: data.evidenceSummary,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load introduction"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action: "approve" | "decline" | "release") {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const body = { approvalNotes: approvalNotes.trim() || undefined };
      if (action === "approve") await approveRelationshipProtection(id, body);
      if (action === "decline") await declineRelationshipProtection(id, body);
      if (action === "release") await releaseRelationshipProtection(id, body);
      setApprovalNotes("");
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, `Failed to ${action} introduction`));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await updateRelationshipProtection(id, {
        introducedAt: fromDatetimeLocalValue(editForm.introducedAt),
        evidenceSummary: editForm.evidenceSummary.trim(),
      });
      setShowEdit(false);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Failed to update introduction"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdvanceLifecycle() {
    if (!id || !protection) return;
    const next = getNextLifecycleStatus(protection.lifecycleStatus);
    if (!next) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await updateRelationshipProtection(id, { lifecycleStatus: next });
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Failed to advance lifecycle"));
    } finally {
      setActionLoading(false);
    }
  }

  const printedAt = new Date().toLocaleString();
  const nextLifecycle = protection ? getNextLifecycleStatus(protection.lifecycleStatus) : null;

  return (
    <AdminLayout title={FP_MODULE_TITLE} showBack>
      <FoundingPartnerShell variant="list">
        {loading && <p className="fp-loading">Loading introduction…</p>}
        {error && <p className="fp-error">{error}</p>}

        {protection && (
          <>
            <div className="fp-print-header">
              {FP_MODULE_TITLE} — Introduction
              <br />
              Printed {printedAt}
            </div>

            <div className="fp-page-header fp-no-print">
              <h2 className="fp-page-title">Introduction</h2>
              <div className="fp-detail-actions">
                <button type="button" className="fp-btn fp-btn-secondary" onClick={() => window.print()}>
                  Print
                </button>
                {protection.protectionStatus === "pending" && (
                  <button type="button" className="fp-btn fp-btn-secondary" onClick={() => setShowEdit(true)}>
                    Edit
                  </button>
                )}
              </div>
            </div>

            <section className="fp-card fp-print-root">
              <h2 className="fp-section-title">Introduction details</h2>
              <dl className="fp-detail-dl">
                <dt>Introduction status</dt>
                <dd>
                  <ProtectionStatusBadge status={protection.protectionStatus} />
                </dd>
                <dt>Relationship lifecycle</dt>
                <dd>
                  <LifecycleStatusBadge status={protection.lifecycleStatus} />
                </dd>
                <dt>Last activity</dt>
                <dd>
                  {protection.lastActivityAt
                    ? formatDateTime(protection.lastActivityAt)
                    : "No activity recorded"}
                </dd>
                <dt>Partner</dt>
                <dd>
                  {protection.partner ? (
                    <Link
                      className="fp-link"
                      to={`/admin/founding-partners/partners/${protection.partner.id}`}
                    >
                      {protection.partner.name}
                    </Link>
                  ) : (
                    protection.partnerName ?? protection.partnerId
                  )}
                </dd>
                <dt>Business</dt>
                <dd>
                  {protection.prospect ? (
                    <Link
                      className="fp-link"
                      to={`/admin/founding-partners/prospects/${protection.prospect.id}`}
                    >
                      {protection.prospect.businessName}
                    </Link>
                  ) : (
                    protection.prospectBusinessName ?? protection.prospectId
                  )}
                </dd>
                <dt>Introduced</dt>
                <dd>{formatDateTime(protection.introducedAt)}</dd>
                <dt>Evidence summary</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{protection.evidenceSummary}</dd>
                <dt>Approval notes</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{protection.approvalNotes || "—"}</dd>
                <dt>Approved at</dt>
                <dd>{formatDateTime(protection.approvedAt)}</dd>
                <dt>Created</dt>
                <dd>{formatDateTime(protection.createdAt)}</dd>
              </dl>
            </section>

            {(protection.protectionStatus === "pending" ||
              protection.protectionStatus === "approved") && (
              <section className="fp-card fp-no-print">
                <h2 className="fp-section-title">Actions</h2>
                {actionError && <p className="fp-error">{actionError}</p>}
                {protection.protectionStatus === "approved" && nextLifecycle && (
                  <p className="fp-muted" style={{ marginBottom: "0.75rem" }}>
                    Advance relationship lifecycle when activity supports the next stage. Activity is
                    recorded in interactions below.
                  </p>
                )}
                <label className="fp-form-label">
                  Notes (optional)
                  <textarea
                    className="fp-form-textarea"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                  />
                </label>
                <div className="fp-detail-actions fp-detail-actions-sticky">
                  {protection.protectionStatus === "pending" && (
                    <>
                      <button
                        type="button"
                        className="fp-btn fp-btn-primary"
                        disabled={actionLoading}
                        onClick={() => runAction("approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="fp-btn fp-btn-danger"
                        disabled={actionLoading}
                        onClick={() => runAction("decline")}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {protection.protectionStatus === "approved" && (
                    <>
                      {nextLifecycle && (
                        <button
                          type="button"
                          className="fp-btn fp-btn-primary"
                          disabled={actionLoading}
                          onClick={handleAdvanceLifecycle}
                        >
                          Advance to {getLifecycleLabel(nextLifecycle)}
                        </button>
                      )}
                      <button
                        type="button"
                        className="fp-btn fp-btn-secondary"
                        disabled={actionLoading}
                        onClick={() => runAction("release")}
                      >
                        Release introduction
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            <CommunicationNotesSection
              relationshipProtectionId={protection.id}
              onNoteAdded={() => load()}
            />

            {showEdit && (
              <div className="admin-overlay fp-overlay fp-no-print" role="dialog" aria-modal="true">
                <div className="admin-sheet">
                  <h3 className="fp-section-title">Edit pending introduction</h3>
                  <form className="fp-form-grid" onSubmit={handleEdit}>
                    <label className="fp-form-label">
                      Introduced date
                      <input
                        type="datetime-local"
                        className="fp-form-input"
                        value={editForm.introducedAt}
                        onChange={(e) => setEditForm({ ...editForm, introducedAt: e.target.value })}
                      />
                    </label>
                    <label className="fp-form-label">
                      Evidence summary *
                      <textarea
                        className="fp-form-textarea"
                        value={editForm.evidenceSummary}
                        onChange={(e) =>
                          setEditForm({ ...editForm, evidenceSummary: e.target.value })
                        }
                        required
                      />
                    </label>
                    <div className="fp-form-actions">
                      <button type="submit" className="fp-btn fp-btn-primary" disabled={actionLoading}>
                        {actionLoading ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="fp-btn fp-btn-secondary"
                        onClick={() => setShowEdit(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </FoundingPartnerShell>
    </AdminLayout>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createPartnerBusinessAmendment,
  createPartnerBusinessNote,
  fetchPartnerBusinessById,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  type PartnerBusinessDetail,
  type PartnerInteraction,
} from "../../api/partner";
import {
  formatDateTime,
} from "../admin/foundingPartners/foundingPartnerFormat";
import InteractionFormFields, {
  createDefaultInteractionFormValues,
  type InteractionFormValues,
} from "../admin/foundingPartners/InteractionFormFields";
import PartnerBusinessDetailsSection from "./PartnerBusinessDetailsSection";
import PartnerInteractionTimelineItem from "./PartnerInteractionTimelineItem";
import ShareWhatYouLearnedFields, {
  buildFieldIntelligencePayload,
  validateShareWhatYouLearned,
} from "./ShareWhatYouLearnedFields";
import {
  HealthStatusBadge,
  LifecycleStatusBadge,
  getProspectStatusLabel,
} from "../admin/foundingPartners/foundingPartnerBadges";
import "./partnerPortal.css";

export default function PartnerBusinessDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PartnerBusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InteractionFormValues>(() => createDefaultInteractionFormValues());
  const [shareLearned, setShareLearned] = useState(false);
  const [learnedObservation, setLearnedObservation] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPartnerBusinessById(id);
      setDetail(res);
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setError(partnerApiErrorMessage(err, "Business not found"));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmitInteraction(e: FormEvent) {
    e.preventDefault();
    if (!id || !form.summary.trim()) return;

    const shareError = validateShareWhatYouLearned(shareLearned, learnedObservation);
    if (shareError) {
      setInteractionError(shareError);
      return;
    }

    setSaving(true);
    setInteractionError(null);
    try {
      await createPartnerBusinessNote(id, {
        visitType: form.visitType,
        summary: form.summary.trim(),
        activityDate: form.activityDate,
        activityTime: form.activityTime,
        primaryContact: form.primaryContact.trim() || undefined,
        duration: form.duration.trim() || undefined,
        interestLevel: form.interestLevel || undefined,
        ...buildFieldIntelligencePayload(shareLearned, learnedObservation),
      });
      setForm(createDefaultInteractionFormValues());
      setShareLearned(false);
      setLearnedObservation("");
      setShowForm(false);
      await load();
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setInteractionError(partnerApiErrorMessage(err, "Failed to log interaction"));
    } finally {
      setSaving(false);
    }
  }

  function upsertInteraction(updated: PartnerInteraction) {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: prev.notes.map((note) => (note.id === updated.id ? updated : note)),
      };
    });
  }

  async function handleAddAmendment(noteId: string, text: string) {
    if (!id) throw new Error("Business not found");
    try {
      const res = await createPartnerBusinessAmendment(id, noteId, text);
      return res.note;
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
      }
      throw new Error(partnerApiErrorMessage(err, "Failed to save clarification"));
    }
  }

  return (
    <>
      <Link to="/partner/businesses" className="partner-portal-back">
        ← My Businesses
      </Link>

      {loading && <p className="partner-portal-loading label-muted-readable">Loading business…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {detail && (
        <>
          <h1 className="partner-portal-page-title">{detail.business.businessName}</h1>

          <PartnerBusinessDetailsSection
            business={detail.business}
            title="Business"
            saveTarget="business"
            statusLabel={getProspectStatusLabel(detail.business.status)}
            onUpdated={(business) => {
              setDetail((prev) => (prev ? { ...prev, business } : prev));
            }}
            onUnauthorized={() => navigate("/partner/login", { replace: true })}
          />

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Relationship</h2>
            <dl className="partner-portal-dl">
              <dt>Lifecycle</dt>
              <dd>
                <LifecycleStatusBadge status={detail.relationship.lifecycleStatus} />
              </dd>
              <dt>Health</dt>
              <dd>
                {detail.relationship.healthStatus != null ? (
                  <>
                    <HealthStatusBadge status={detail.relationship.healthStatus} />
                    {detail.relationship.daysSinceLastActivity != null && (
                      <span style={{ marginLeft: "0.5rem" }}>
                        {detail.relationship.daysSinceLastActivity} days since activity
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Introduced</dt>
              <dd>{formatDateTime(detail.relationship.introducedAt)}</dd>
              <dt>Last activity</dt>
              <dd>
                {detail.relationship.lastActivityAt
                  ? formatDateTime(detail.relationship.lastActivityAt)
                  : "No activity recorded"}
              </dd>
            </dl>
          </section>

          <section className="partner-portal-card">
            <div className="partner-portal-section-header">
              <h2 className="partner-portal-card-title">Interactions</h2>
              <button
                type="button"
                className="partner-portal-logout"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Cancel" : "Log interaction"}
              </button>
            </div>

            {interactionError && <p className="partner-portal-error">{interactionError}</p>}

            {showForm && (
              <form onSubmit={handleSubmitInteraction} className="partner-portal-form-stack">
                <InteractionFormFields
                  values={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  inputClassName="partner-portal-form-input"
                  selectClassName="partner-portal-form-select"
                  textareaClassName="partner-portal-form-textarea"
                  labelClassName="partner-portal-form-label"
                />
                <ShareWhatYouLearnedFields
                  enabled={shareLearned}
                  observation={learnedObservation}
                  onEnabledChange={setShareLearned}
                  onObservationChange={setLearnedObservation}
                />
                <button
                  type="submit"
                  className="partner-portal-btn partner-portal-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save interaction"}
                </button>
              </form>
            )}

            {detail.notes.length === 0 ? (
              <p className="partner-portal-empty label-muted-readable">No interactions yet.</p>
            ) : (
              detail.notes.map((interaction) => (
                <PartnerInteractionTimelineItem
                  key={interaction.id}
                  interaction={interaction}
                  className="partner-portal-note-item"
                  onAmendmentSaved={upsertInteraction}
                  onAddAmendment={handleAddAmendment}
                />
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}

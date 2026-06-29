import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createPartnerIntroductionAmendment,
  createPartnerIntroductionNote,
  fetchPartnerIntroductionById,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  updatePartnerIntroduction,
  PARTNER_RELATIONSHIP_STAGE_LABELS,
  type PartnerDuplicateMatch,
  type PartnerIntroductionDetail,
  type PartnerInteraction,
} from "../../api/partner";
import { formatDate } from "../admin/foundingPartners/foundingPartnerFormat";
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
import "./partnerPortal.css";

function StageBadge({ stage }: { stage: PartnerIntroductionDetail["relationship"]["stage"] }) {
  return (
    <span className={`partner-portal-stage-badge partner-portal-stage-badge-${stage}`}>
      {PARTNER_RELATIONSHIP_STAGE_LABELS[stage]}
    </span>
  );
}

export default function PartnerIntroductionDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const possibleDuplicates =
    (location.state as { possibleDuplicates?: PartnerDuplicateMatch[] } | null)?.possibleDuplicates ?? [];
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PartnerIntroductionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [form, setForm] = useState<InteractionFormValues>(() => createDefaultInteractionFormValues());
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [isMeaningful, setIsMeaningful] = useState(false);
  const [shareLearned, setShareLearned] = useState(false);
  const [learnedObservation, setLearnedObservation] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPartnerIntroductionById(id);
      setDetail(res);
      setNextFollowUpDate(
        res.relationship.nextFollowUpDate ? res.relationship.nextFollowUpDate.slice(0, 10) : ""
      );
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setError(partnerApiErrorMessage(err, "Introduction not found"));
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
      await createPartnerIntroductionNote(id, {
        visitType: form.visitType,
        summary: form.summary.trim(),
        activityDate: form.activityDate,
        activityTime: form.activityTime,
        primaryContact: form.primaryContact.trim() || undefined,
        duration: form.duration.trim() || undefined,
        interestLevel: form.interestLevel || undefined,
        isMeaningful,
        ...buildFieldIntelligencePayload(shareLearned, learnedObservation),
      });
      setForm(createDefaultInteractionFormValues());
      setIsMeaningful(false);
      setShareLearned(false);
      setLearnedObservation("");
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

  async function handleSaveFollowUp(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setFollowUpSaving(true);
    setFollowUpError(null);
    try {
      const res = await updatePartnerIntroduction(id, {
        nextFollowUpDate: nextFollowUpDate || null,
      });
      setDetail((prev) =>
        prev && res.relationship ? { ...prev, relationship: res.relationship } : prev
      );
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setFollowUpError(partnerApiErrorMessage(err, "Failed to save follow-up date"));
    } finally {
      setFollowUpSaving(false);
    }
  }

  function upsertInteraction(updated: PartnerInteraction) {
    setDetail((prev) => {
      if (!prev) return prev;
      const notes = prev.notes.map((note) => (note.id === updated.id ? updated : note));
      const lastMeaningfulConversation =
        prev.lastMeaningfulConversation?.id === updated.id
          ? updated
          : prev.lastMeaningfulConversation;
      return { ...prev, notes, lastMeaningfulConversation };
    });
  }

  async function handleAddAmendment(noteId: string, text: string) {
    if (!id) throw new Error("Introduction not found");
    try {
      const res = await createPartnerIntroductionAmendment(id, noteId, text);
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
      <Link to="/partner/introductions" className="partner-portal-back">
        ← Introductions
      </Link>

      {loading && <p className="partner-portal-loading label-muted-readable">Loading…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {detail && (
        <>
          <h1 className="partner-portal-page-title">{detail.business.businessName}</h1>
          <div className="partner-portal-business-meta partner-portal-detail-meta">
            <StageBadge stage={detail.relationship.stage} />
            {detail.relationship.isStewarding && (
              <span className="partner-portal-stewarding-pill">Stewarding this relationship</span>
            )}
          </div>

          {possibleDuplicates.length > 0 && (
            <section className="partner-portal-card partner-portal-warn-card">
              <h2 className="partner-portal-card-title">Possible duplicates</h2>
              <p className="partner-portal-intro-copy label-muted-readable">These existing records may match this business.</p>
              <ul className="partner-portal-duplicate-list">
                {possibleDuplicates.map((d) => (
                  <li key={d.prospectId}>
                    {d.businessName} ({d.confidence}: {d.matchedOn.join(", ")})
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="partner-portal-card partner-portal-meaningful-hero">
            <h2 className="partner-portal-card-title">Last meaningful conversation</h2>
            {detail.lastMeaningfulConversation ? (
              <PartnerInteractionTimelineItem
                interaction={detail.lastMeaningfulConversation}
                className="partner-portal-meaningful-card"
                meaningfulBadge={<span className="partner-portal-meaningful-pill">Meaningful</span>}
                onAmendmentSaved={upsertInteraction}
                onAddAmendment={handleAddAmendment}
              />
            ) : (
              <p className="partner-portal-empty label-muted-readable">
                No meaningful conversation recorded yet. Mark an interaction as meaningful when the owner shares real
                business context — even on your first meeting.
              </p>
            )}
          </section>

          {detail.relationship.isStewarding && (
            <p className="partner-portal-stewarding-banner">
              You are stewarding this relationship. Relationship protection is reviewed and granted by admin separately.
            </p>
          )}

          <section className="partner-portal-card">
            <div className="partner-portal-section-header">
              <h2 className="partner-portal-card-title">Log interaction</h2>
              <button
                type="button"
                className="partner-portal-logout"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Hide" : "Show"}
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
                <label className="partner-portal-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isMeaningful}
                    onChange={(e) => setIsMeaningful(e.target.checked)}
                  />
                  <span>
                    This was a meaningful conversation — the owner shared business context, challenges, goals, or plans
                  </span>
                </label>
                <button
                  type="submit"
                  className="partner-portal-btn partner-portal-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save interaction"}
                </button>
              </form>
            )}
          </section>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Next follow-up</h2>
            {followUpError && <p className="partner-portal-error">{followUpError}</p>}
            <form onSubmit={handleSaveFollowUp}>
              <label className="partner-portal-form-label">
                Planned follow-up date
                <input
                  type="date"
                  className="partner-portal-form-input"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="partner-portal-btn partner-portal-btn-secondary"
                disabled={followUpSaving}
              >
                {followUpSaving ? "Saving…" : "Save follow-up date"}
              </button>
            </form>
          </section>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Interactions</h2>
            {detail.notes.length === 0 ? (
              <p className="partner-portal-empty label-muted-readable">No interactions yet.</p>
            ) : (
              detail.notes.map((interaction) => (
                <PartnerInteractionTimelineItem
                  key={interaction.id}
                  interaction={interaction}
                  className="partner-portal-note-item"
                  meaningfulBadge={
                    interaction.isMeaningful ? (
                      <span className="partner-portal-meaningful-pill">Meaningful</span>
                    ) : undefined
                  }
                  onAmendmentSaved={upsertInteraction}
                  onAddAmendment={handleAddAmendment}
                />
              ))
            )}
          </section>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Relationship dates</h2>
            <dl className="partner-portal-dl">
              <dt>First contact</dt>
              <dd>{formatDate(detail.relationship.firstContactDate ?? detail.relationship.introducedAt)}</dd>
              <dt>Last visit</dt>
              <dd>{formatDate(detail.relationship.lastVisitDate)}</dd>
              <dt>Next follow-up</dt>
              <dd>{formatDate(detail.relationship.nextFollowUpDate)}</dd>
            </dl>
          </section>

          <PartnerBusinessDetailsSection
            business={detail.business}
            saveTarget="introduction"
            onUpdated={(business) => {
              setDetail((prev) => (prev ? { ...prev, business } : prev));
            }}
            onUnauthorized={() => navigate("/partner/login", { replace: true })}
          />
        </>
      )}
    </>
  );
}

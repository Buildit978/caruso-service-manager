import { useEffect, useState, type FormEvent } from "react";
import {
  formatWebsiteHref,
  formatWebsiteLabel,
} from "../admin/foundingPartners/foundingPartnerFormat";
import {
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  patchPartnerBusinessDetails,
  patchPartnerIntroductionBusiness,
  type PartnerBusinessDetail,
} from "../../api/partner";

type PartnerBusinessRecord = PartnerBusinessDetail["business"];

type PartnerBusinessDetailsSectionProps = {
  business: PartnerBusinessRecord;
  saveTarget: "introduction" | "business";
  onUpdated: (business: PartnerBusinessRecord) => void;
  onUnauthorized?: () => void;
  title?: string;
  showNotes?: boolean;
  statusLabel?: string;
};

function businessToFormValues(business: PartnerBusinessRecord) {
  return {
    businessName: business.businessName,
    ownerName: business.contactName ?? "",
    phone: business.phone ?? "",
    email: business.email ?? "",
    address: business.location ?? "",
    website: business.website ?? "",
    notes: business.notes ?? "",
  };
}

export default function PartnerBusinessDetailsSection({
  business,
  saveTarget,
  onUpdated,
  onUnauthorized,
  title = "Business details",
  showNotes = true,
  statusLabel,
}: PartnerBusinessDetailsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => businessToFormValues(business));

  useEffect(() => {
    if (!editing) {
      setForm(businessToFormValues(business));
    }
  }, [business, editing]);

  function handleCancel() {
    setForm(businessToFormValues(business));
    setError(null);
    setEditing(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        notes: showNotes ? form.notes.trim() : undefined,
      };

      const res =
        saveTarget === "introduction"
          ? await patchPartnerIntroductionBusiness(business.id, payload)
          : await patchPartnerBusinessDetails(business.id, payload);

      setForm(businessToFormValues(res.business));
      onUpdated(res.business);
      setEditing(false);
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        onUnauthorized?.();
      }
      setError(partnerApiErrorMessage(err, "Failed to save business details"));
    } finally {
      setSaving(false);
    }
  }

  const websiteHref = formatWebsiteHref(business.website);

  return (
    <section className="partner-portal-card">
      <div className="partner-portal-section-header">
        <h2 className="partner-portal-card-title">{title}</h2>
        {!editing && (
          <button type="button" className="partner-portal-logout" onClick={() => setEditing(true)}>
            Edit details
          </button>
        )}
      </div>

      {!editing && (
        <p className="partner-portal-amendment-help label-muted-readable">
          Updates the current business record. Past interactions stay as originally logged.
        </p>
      )}

      {error && <p className="partner-portal-error">{error}</p>}

      {editing ? (
        <form onSubmit={handleSubmit} className="partner-portal-form-stack">
          <label className="partner-portal-form-label">
            Business name *
            <input
              className="partner-portal-form-input"
              value={form.businessName}
              onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
              required
            />
          </label>
          <label className="partner-portal-form-label">
            Owner name
            <input
              className="partner-portal-form-input"
              value={form.ownerName}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))}
            />
          </label>
          <label className="partner-portal-form-label">
            Phone
            <input
              type="tel"
              className="partner-portal-form-input"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </label>
          <label className="partner-portal-form-label">
            Email
            <input
              type="email"
              className="partner-portal-form-input"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>
          <label className="partner-portal-form-label">
            Address
            <input
              className="partner-portal-form-input"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </label>
          <label className="partner-portal-form-label">
            Website
            <input
              type="url"
              className="partner-portal-form-input"
              value={form.website}
              onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
            />
          </label>
          {showNotes && (
            <label className="partner-portal-form-label">
              Notes
              <textarea
                className="partner-portal-form-textarea"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>
          )}
          <div className="partner-portal-form-actions">
            <button
              type="submit"
              className="partner-portal-btn partner-portal-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="partner-portal-btn partner-portal-btn-secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="partner-portal-dl">
          <dt>Business name</dt>
          <dd>{business.businessName}</dd>
          <dt>Owner</dt>
          <dd>{business.contactName || "—"}</dd>
          <dt>Phone</dt>
          <dd>{business.phone || "—"}</dd>
          <dt>Email</dt>
          <dd>{business.email || "—"}</dd>
          <dt>Address</dt>
          <dd>{business.location || "—"}</dd>
          <dt>Website</dt>
          <dd>
            {websiteHref ? (
              <a
                className="partner-portal-external"
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatWebsiteLabel(business.website)}
              </a>
            ) : (
              "—"
            )}
          </dd>
          {showNotes && (
            <>
              <dt>Notes</dt>
              <dd>{business.notes || "—"}</dd>
            </>
          )}
          {statusLabel != null && (
            <>
              <dt>Adoption stage</dt>
              <dd>{statusLabel}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

import { useState } from "react";
import {
  disablePartnerPortalAccess,
  enablePartnerPortalAccess,
  type PartnerPortalAccess,
} from "../../../api/adminFoundingPartners";
import { formatDateTime, apiErrorMessage } from "./foundingPartnerFormat";

interface PortalAccessSectionProps {
  partnerId: string;
  portalAccess?: PartnerPortalAccess;
  onChanged: () => void | Promise<void>;
}

function PortalAccessStatusBadge({ status }: { status: PartnerPortalAccess["status"] }) {
  const enabled = status === "enabled";
  return (
    <span
      className={`fp-badge fp-portal-access-badge ${
        enabled ? "fp-portal-access-badge-enabled" : "fp-portal-access-badge-disabled"
      }`}
    >
      <span
        className={`fp-portal-access-dot ${
          enabled ? "fp-portal-access-dot-enabled" : "fp-portal-access-dot-disabled"
        }`}
        aria-hidden="true"
      />
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export default function PortalAccessSection({
  partnerId,
  portalAccess,
  onChanged,
}: PortalAccessSectionProps) {
  const status = portalAccess?.status ?? "disabled";
  const enabled = status === "enabled";
  const [actionLoading, setActionLoading] = useState(false);

  async function handleEnable() {
    setActionLoading(true);
    try {
      await enablePartnerPortalAccess(partnerId);
      await onChanged();
    } catch (err) {
      window.alert(apiErrorMessage(err, "Failed to enable portal access"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisable() {
    const confirmed = window.confirm(
      "Disable partner portal access? The partner will not be able to sign in until access is enabled again. Relationships and interactions are preserved."
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await disablePartnerPortalAccess(partnerId);
      await onChanged();
    } catch (err) {
      window.alert(apiErrorMessage(err, "Failed to disable portal access"));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="fp-card fp-no-print">
      <div className="fp-detail-header">
        <h2 className="fp-section-title">Portal access</h2>
        <div className="fp-detail-actions">
          {enabled ? (
            <button
              type="button"
              className="fp-btn fp-btn-secondary fp-btn-sm"
              onClick={handleDisable}
              disabled={actionLoading}
            >
              {actionLoading ? "Disabling…" : "Disable portal access"}
            </button>
          ) : (
            <button
              type="button"
              className="fp-btn fp-btn-primary fp-btn-sm"
              onClick={handleEnable}
              disabled={actionLoading}
            >
              {actionLoading ? "Enabling…" : "Enable portal access"}
            </button>
          )}
        </div>
      </div>

      <dl className="fp-detail-dl">
        <dt>Status</dt>
        <dd>
          <PortalAccessStatusBadge status={status} />
        </dd>
        <dt>Enabled date</dt>
        <dd>{portalAccess?.enabledAt ? formatDateTime(portalAccess.enabledAt) : "—"}</dd>
        <dt>Disabled date</dt>
        <dd>{portalAccess?.disabledAt ? formatDateTime(portalAccess.disabledAt) : "—"}</dd>
        <dt>Last login</dt>
        <dd>{portalAccess?.lastLoginAt ? formatDateTime(portalAccess.lastLoginAt) : "Never"}</dd>
      </dl>
    </section>
  );
}

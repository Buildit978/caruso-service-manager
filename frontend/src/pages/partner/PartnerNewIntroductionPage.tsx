import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createPartnerIntroduction,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
} from "../../api/partner";
import "./partnerPortal.css";

export default function PartnerNewIntroductionPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [conversationNotes, setConversationNotes] = useState("");
  const [isMeaningful, setIsMeaningful] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await createPartnerIntroduction({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        conversationNotes: conversationNotes.trim(),
        isMeaningful,
        type: "walkIn",
      });
      navigate(`/partner/introductions/${res.business.id}`, {
        replace: true,
        state: { possibleDuplicates: res.possibleDuplicates },
      });
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setError(partnerApiErrorMessage(err, "Failed to save introduction"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link to="/partner/introductions" className="partner-portal-back">
        ← Introductions
      </Link>
      <h1 className="partner-portal-page-title">New Shop Introduction</h1>
      <p className="partner-portal-intro-copy">
        Capture the beginning of a relationship. Record what matters so you know where to continue next time.
      </p>

      {error && <p className="partner-portal-error">{error}</p>}

      <form onSubmit={handleSubmit} className="partner-portal-card">
        <label className="partner-portal-form-label">
          Business name *
          <input
            className="partner-portal-form-input"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
        </label>
        <label className="partner-portal-form-label">
          Owner name *
          <input
            className="partner-portal-form-input"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
          />
        </label>
        <label className="partner-portal-form-label">
          Phone
          <input
            type="tel"
            className="partner-portal-form-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="partner-portal-form-label">
          Email
          <input
            type="email"
            className="partner-portal-form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="partner-portal-form-label">
          Address
          <input
            className="partner-portal-form-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label className="partner-portal-form-label">
          What did you talk about? *
          <textarea
            className="partner-portal-form-textarea"
            value={conversationNotes}
            onChange={(e) => setConversationNotes(e.target.value)}
            required
          />
        </label>
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
        <button type="submit" className="partner-portal-btn partner-portal-btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save introduction"}
        </button>
      </form>
    </>
  );
}

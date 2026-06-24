import { Router, type Request, type Response } from "express";
import { FoundingPartner } from "../../models/foundingPartner.model";
import { RelationshipProtection } from "../../models/relationshipProtection.model";
import { buildPortalAccessSnapshot } from "../../utils/foundingPartners/partnerPortalAccess";

const router = Router();

function toIso(date: Date | undefined | null): string | undefined {
  if (date == null) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * GET /api/partner/auth/me
 * Requires partner token (requirePartnerAuth on mount).
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const partnerActor = req.partnerActor;
    if (!partnerActor?.partnerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const partner = await FoundingPartner.findById(partnerActor.partnerId).lean();
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    const [portalAccess, stewardedBusinessCount] = await Promise.all([
      buildPortalAccessSnapshot(partner),
      RelationshipProtection.countDocuments({
        partnerId: partnerActor.partnerId,
        protectionStatus: "approved",
      }),
    ]);

    return res.json({
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
      portalAccess,
      lastPortalLoginAt: toIso(partner.lastPortalLoginAt),
      stewardedBusinessCount,
    });
  } catch (err) {
    console.error("[PartnerAuthMe] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

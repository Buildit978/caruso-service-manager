// backend/src/routes/settings.route.ts
import express from "express";
import rateLimit from "express-rate-limit";
import { Settings } from "../models/settings.model";
import { Account } from "../models/account.model";
import { User } from "../models/user.model";
import { requireRole } from "../middleware/requireRole";
import { Types } from "mongoose";

const router = express.Router();

// Rate limiter for shop code regeneration (1 per 10 minutes)
const regenerateShopCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1,
  message: { message: "Shop code can only be regenerated once per 10 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// All settings routes require owner or manager role
router.use(requireRole(["owner", "manager"]));

// Helper: always return a settings doc scoped by accountId (create default if none)
async function getOrCreateSettings(accountId: any) {
    let settings = await Settings.findOne({ accountId });
    if (!settings) {
        settings = await Settings.create({ accountId });
    }
    return settings;
}

// GET /api/settings
router.get("/", async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        const actor = (req as any).actor;
        
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const settings = await getOrCreateSettings(accountId);
        
        // Include shopCode (Account.slug) for owners only
        const response: any = settings.toObject();
        if (actor?.role === "owner") {
            const account = await Account.findById(accountId).select("slug").lean();
            response.shopCode = account?.slug || null;
        }
        
        return res.json(response);
    } catch (error) {
        console.error("Error in GET /api/settings:", error);
        return res.status(500).json({ message: "Failed to load settings" });
    }
});

// PUT /api/settings
router.put("/", async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        const actor = (req as any).actor;
        
        if (!accountId || !actor?._id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Only owners can edit shop name (V1)
        const { shopName, taxRate, discountType, discountValue } = req.body;

        const settings = await getOrCreateSettings(accountId);

        if (typeof shopName === "string") {
            // Only owners can edit shop name
            if (actor.role !== "owner") {
                return res.status(403).json({ message: "Only owners can edit shop name" });
            }
            settings.shopName = shopName;
        }

        if (typeof taxRate === "number") {
            // taxRate comes in as percent (e.g. 13), convert to 0.13
            settings.taxRate = Math.max(0, Math.min(taxRate / 100, 1));
        }

        if (discountType === "none" || discountType === "percent" || discountType === "flat") {
            settings.discountType = discountType;
        }

        if (typeof discountValue === "number") {
            settings.discountValue = Math.max(0, discountValue);
        }

        await settings.save();

        return res.json(settings);
    } catch (error) {
        console.error("Error in PUT /api/settings:", error);
        return res.status(500).json({ message: "Failed to update settings" });
    }
});

const INVOICE_PROFILE_KEYS = ["shopName", "logoUrl", "address", "phone", "email", "taxId"] as const;

function normalizeWhitespace(s: string): string {
    return s.trim().replace(/\s+/g, " ");
}

// GET /api/settings/invoice-profile
router.get("/invoice-profile", async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const settings = await getOrCreateSettings(accountId);
        const invoiceProfile = settings.invoiceProfile ?? {};
        return res.status(200).json(invoiceProfile);
    } catch (error) {
        console.error("Error in GET /api/settings/invoice-profile:", error);
        return res.status(500).json({ message: "Failed to load invoice profile" });
    }
});

// PATCH /api/settings/invoice-profile (owner only)
router.patch("/invoice-profile", requireRole(["owner"]), async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const settings = await getOrCreateSettings(accountId);

        const body = req.body ?? {};
        const updates: Record<string, string> = {};

        for (const key of INVOICE_PROFILE_KEYS) {
            if (key in body && typeof body[key] === "string") {
                updates[key] = normalizeWhitespace(body[key]);
            }
        }

        settings.invoiceProfile = {
            ...(settings.invoiceProfile ?? {}),
            ...updates,
        };
        await settings.save();

        const invoiceProfile = settings.invoiceProfile ?? {};
        return res.status(200).json(invoiceProfile);
    } catch (error) {
        console.error("Error in PATCH /api/settings/invoice-profile:", error);
        return res.status(500).json({ message: "Failed to update invoice profile" });
    }
});

// PATCH /api/settings/permissions (owner only)
router.patch("/permissions", requireRole(["owner"]), async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { permissions } = req.body;

        if (!permissions || typeof permissions !== "object") {
            return res.status(400).json({ message: "Permissions object is required" });
        }

        const settings = await getOrCreateSettings(accountId);

        // Update permissions (merge with existing, validate structure)
        if (permissions.manager) {
            if (typeof permissions.manager.canManageUsers === "boolean") {
                settings.permissions.manager.canManageUsers = permissions.manager.canManageUsers;
            }
            if (typeof permissions.manager.canEditSettingsName === "boolean") {
                settings.permissions.manager.canEditSettingsName = permissions.manager.canEditSettingsName;
            }
            if (typeof permissions.manager.canSeeFinancials === "boolean") {
                settings.permissions.manager.canSeeFinancials = permissions.manager.canSeeFinancials;
            }
        }

        if (permissions.technician) {
            if (typeof permissions.technician.canChangeStatus === "boolean") {
                settings.permissions.technician.canChangeStatus = permissions.technician.canChangeStatus;
            }
            if (typeof permissions.technician.canPostInternalMessages === "boolean") {
                settings.permissions.technician.canPostInternalMessages = permissions.technician.canPostInternalMessages;
            }
            if (typeof permissions.technician.canEditLineItemsQty === "boolean") {
                settings.permissions.technician.canEditLineItemsQty = permissions.technician.canEditLineItemsQty;
            }
            if (typeof permissions.technician.canEditLineItemDesc === "boolean") {
                settings.permissions.technician.canEditLineItemDesc = permissions.technician.canEditLineItemDesc;
            }
        }

        await settings.save();

        return res.json(settings);
    } catch (error) {
        console.error("Error in PATCH /api/settings/permissions:", error);
        return res.status(500).json({ message: "Failed to update permissions" });
    }
});

// PATCH /api/settings/role-access (owner only) - V1 role kill-switch
router.patch("/role-access", requireRole(["owner"]), async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { managersEnabled, techniciansEnabled } = req.body;

        const settings = await getOrCreateSettings(accountId);

        // Update role access toggles
        if (typeof managersEnabled === "boolean") {
            settings.roleAccess.managersEnabled = managersEnabled;
        }
        if (typeof techniciansEnabled === "boolean") {
            settings.roleAccess.techniciansEnabled = techniciansEnabled;
        }

        await settings.save();

        return res.json({
            roleAccess: {
                managersEnabled: settings.roleAccess.managersEnabled,
                techniciansEnabled: settings.roleAccess.techniciansEnabled,
            },
        });
    } catch (error) {
        console.error("Error in PATCH /api/settings/role-access:", error);
        return res.status(500).json({ message: "Failed to update role access" });
    }
});

// POST /api/settings/account/deactivate (owner only)
router.post("/account/deactivate", requireRole(["owner"]), async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Set Account.isActive = false
        await Account.updateOne(
            { _id: accountId },
            { isActive: false }
        );

        // Set tokenInvalidBefore = now for all users in this accountId
        const now = new Date();
        await User.updateMany(
            { accountId },
            { tokenInvalidBefore: now }
        );

        // Optionally set User.isActive = false for all users in accountId
        await User.updateMany(
            { accountId },
            { isActive: false }
        );

        return res.json({ ok: true });
    } catch (error) {
        console.error("Error in POST /api/settings/account/deactivate:", error);
        return res.status(500).json({ message: "Failed to deactivate account" });
    }
});

// POST /api/settings/account/regenerate-shop-code (owner only)
router.post("/account/regenerate-shop-code", requireRole(["owner"]), regenerateShopCodeLimiter, async (req, res) => {
    try {
        const accountId = (req as any).accountId;
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { generateShopCode } = await import("../utils/slug");
        const Account = (await import("../models/account.model")).Account;

        // Generate a new unique slug (retry up to 10 times if collision)
        let newSlug: string;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            newSlug = generateShopCode();
            const existing = await Account.findOne({ slug: newSlug }).lean();
            if (!existing) break;
            attempts++;
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            return res.status(500).json({ message: "Failed to generate unique shop code. Please try again." });
        }

        // Update Account.slug
        await Account.updateOne(
            { _id: accountId },
            { slug: newSlug }
        );

        return res.json({ ok: true, shopCode: newSlug });
    } catch (error) {
        console.error("Error in POST /api/settings/account/regenerate-shop-code:", error);
        return res.status(500).json({ message: "Failed to regenerate shop code" });
    }
});

export default router;

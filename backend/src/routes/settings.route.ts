// backend/src/routes/settings.route.ts
import express from "express";
import { Settings } from "../models/settings.model";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

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
        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const settings = await getOrCreateSettings(accountId);
        return res.json(settings);
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

export default router;

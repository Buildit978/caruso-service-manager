// backend/src/routes/settings.route.ts
import express from "express";
import { Settings } from "../models/settings.model";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

// All settings routes require owner or manager role
router.use(requireRole(["owner", "manager"]));

// Helper: always return a settings doc (create default if none)
async function getOrCreateSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({});
    }
    return settings;
}

// GET /api/settings
router.get("/", async (req, res) => {
    try {
        const settings = await getOrCreateSettings();
        return res.json(settings);
    } catch (error) {
        console.error("Error in GET /api/settings:", error);
        return res.status(500).json({ message: "Failed to load settings" });
    }
});

// PUT /api/settings
router.put("/", async (req, res) => {
    try {
        const { shopName, taxRate, discountType, discountValue } = req.body;

        const settings = await getOrCreateSettings();

        if (typeof shopName === "string") {
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

export default router;

import express from "express";
import { adminAuditContext } from "../../middleware/adminAuditContext";
import { requireSuperAdmin } from "../../middleware/requireSuperAdmin";
import adminBetaRouter from "../adminBeta.route";
import securityRouter from "./security.route";
import adminUsersRouter from "./adminUsers.route";
import adminAuthRouter from "./adminAuth.route";
import { User } from "../../models/user.model";

const router = express.Router();

router.use(adminAuditContext);

/**
 * GET /api/admin/me — current admin actor (id, email, name, role). For token-paste flow and role display.
 */
router.get("/me", async (req, res) => {
  const adminActor = (req as any).adminActor;
  if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });
  const user = await User.findById(adminActor._id).select("email name role").lean();
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin" && user.role !== "superadmin") return res.status(403).json({ message: "Forbidden" });
  return res.json({
    id: (user as any)._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

router.use("/auth", adminAuthRouter);
router.use("/accounts", requireSuperAdmin, securityRouter);
router.use("/beta", adminBetaRouter);
router.use("/admin-users", requireSuperAdmin, adminUsersRouter);

export default router;

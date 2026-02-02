import express from "express";
import { adminAuditContext } from "../../middleware/adminAuditContext";
import { requireSuperAdmin } from "../../middleware/requireSuperAdmin";
import adminBetaRouter from "../adminBeta.route";
import securityRouter from "./security.route";
import adminUsersRouter from "./adminUsers.route";
import adminAuthRouter from "./adminAuth.route";

const router = express.Router();

router.use(adminAuditContext);
router.use("/auth", adminAuthRouter);
router.use("/accounts", securityRouter);
router.use("/beta", adminBetaRouter);
router.use("/admin-users", requireSuperAdmin, adminUsersRouter);

export default router;

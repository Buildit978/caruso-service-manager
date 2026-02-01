import express from "express";
import { adminAuditContext } from "../../middleware/adminAuditContext";
import adminBetaRouter from "../adminBeta.route";
import securityRouter from "./security.route";

const router = express.Router();

router.use(adminAuditContext);
router.use("/accounts", securityRouter);
router.use("/beta", adminBetaRouter);

export default router;

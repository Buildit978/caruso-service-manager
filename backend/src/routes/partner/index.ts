import { Router } from "express";
import partnerDataRouter from "./partnerData.route";

const router = Router();

router.use(partnerDataRouter);

export default router;

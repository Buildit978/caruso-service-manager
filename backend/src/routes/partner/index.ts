import { Router } from "express";
import partnerDataRouter from "./partnerData.route";
import partnerIntroductionsRouter from "./partnerIntroductions.route";

const router = Router();

router.use("/introductions", partnerIntroductionsRouter);
router.use(partnerDataRouter);

export default router;

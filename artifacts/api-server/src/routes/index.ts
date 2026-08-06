import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import analyzeRouter from "./analyze";
import memoryRouter from "./memory";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use("/chat", chatRouter);
router.use("/analyze", analyzeRouter);
router.use("/memory", memoryRouter);

export default router;

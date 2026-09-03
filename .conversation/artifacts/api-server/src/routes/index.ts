import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradeproRouter from "./tradepro";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tradeproRouter);
router.use(configRouter);

export default router;

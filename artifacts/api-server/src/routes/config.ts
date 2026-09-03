import { Router, type IRouter } from "express";
import {
  GetTradingConfigResponse,
  UpdateTradingConfigBody,
  UpdateTradingConfigResponse,
} from "@workspace/api-zod";
import { getTradingConfig, refreshCurrencyRate, refreshFeeRate, updateTaxConfig } from "../services/trading-config-store";

const router: IRouter = Router();

router.get("/config/trading", async (_req, res) => {
  await refreshCurrencyRate();
  refreshFeeRate();
  res.json(GetTradingConfigResponse.parse(getTradingConfig()));
});

router.post("/config/trading", (req, res) => {
  try {
    const body = UpdateTradingConfigBody.parse(req.body);
    res.json(UpdateTradingConfigResponse.parse(updateTaxConfig(body)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid trading configuration" });
  }
});

export default router;
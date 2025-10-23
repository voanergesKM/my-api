import { Router } from "express";
import { healthCheckHandler } from "~/controllers/healthCheck.js";
import { asyncHandler } from "~/utils/async-handler.js";

const router = Router();

router.get("/", asyncHandler(healthCheckHandler));

export { router as healthCheckRoutes };

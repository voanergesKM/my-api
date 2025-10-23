import { Router } from "express";

import { healthCheckRoutes } from "./api/health-check.js";
import { recipieRoutes } from "./api/recipie.js";

export const apiV1Router = Router();

apiV1Router.use("/health-check", healthCheckRoutes);
apiV1Router.use("/recipie", recipieRoutes);

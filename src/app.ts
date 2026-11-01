import express from "express";
import cors from "cors";

import { errorHandler, requestId } from "./middlewares/errorHandler.js";
import { apiV1Router } from "./routes/index.js";

export function buildApp() {
  const app = express();

  app.use(requestId);
  app.use(cors());
  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  app.use(errorHandler);

  return app;
}

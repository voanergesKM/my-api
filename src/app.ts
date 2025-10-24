import express from "express";
import cors from "cors";

import { apiV1Router } from "./routes/index.js";

export function buildApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  return app;
}

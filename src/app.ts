import express from "express";
import cors from "cors";

import { apiV1Router } from "./routes/index.js";

export function buildApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  app.get("/", (req, res) => {
    res.send(`
    <h1>OCR Server</h1>
    <form action="/api/v1/recipie" method="post" enctype="multipart/form-data">
      <input type="file" name="file" accept="image/*" />
      <button type="submit">Upload</button>
    </form>
  `);
  });

  return app;
}

import crypto from "crypto";

import type { Request, Response, NextFunction } from "express";

export function verifySignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ts = req.headers["x-ts"] as string;
  const signature = req.headers["x-sign"];

  if (!ts || !signature) {
    return res.status(401).json({ error: "missing signature" });
  }

  const timestamp = Number(ts);
  if (isNaN(timestamp) || timestamp <= 0) {
    return res.status(400).json({ error: "invalid timestamp" });
  }

  const secret = process.env.API_SECRET as string;
  const expected = crypto.createHmac("sha256", secret).update(ts).digest("hex");

  if (signature !== expected) {
    return res.status(403).json({ error: "invalid signature" });
  }

  next();
}

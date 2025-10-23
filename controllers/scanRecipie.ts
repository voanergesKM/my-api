import fs from "node:fs";

import type { Request, Response } from "express";
import HttpErrors from "http-errors";

import { callChatModel } from "../services/llmService.js";
import { detectText } from "../services/vision-service.js";

import { getRecipieScanPrompt } from "../utils/getRecipieScanPrompt.js";

export async function scanRecipieHandler(
  req: Request & { file?: Express.Multer.File },
  res: Response,
): Promise<void> {
  if (!req.file) {
    throw new HttpErrors.BadRequest("No file uploaded");
  }

  const { path: filePath, mimetype } = req.file;

  if (mimetype !== "image/jpeg") {
    fs.unlinkSync(filePath);
    throw new HttpErrors.NotAcceptable("Please, select an image");
  }

  const text = await detectText(filePath);

  if (!text) {
    fs.unlinkSync(filePath);
    throw new HttpErrors.BadRequest("No text detected");
  }

  const result = await callChatModel([
    { role: "user", content: getRecipieScanPrompt(text) },
  ]);

  const clearedResult = result.replaceAll(/```json|```/g, "").trim();
  const parsedResult = JSON.parse(clearedResult);

  fs.unlinkSync(filePath);

  res.status(200).json({ data: parsedResult, message: "Receipt processed" });
}

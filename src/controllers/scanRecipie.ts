import fs from "node:fs";

import type { Request, Response } from "express";
import HttpErrors from "http-errors";
import { callChatModel } from "~/services/llmService.js";
import { getRecipieScanPrompt } from "~/prompts/getRecipieScanPrompt.js";
import { detectText } from "~/services/vision-service.js";

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

  const normalizedText = normalizeReceiptText(text);

  const result = await callChatModel(
    [{ role: "user", content: getRecipieScanPrompt(normalizedText) }],
    "Qwen/Qwen2.5-7B-Instruct",
  );

  const clearedResult = result.replaceAll(/```json|```/g, "").trim();

  const parsedResult = JSON.parse(clearedResult);

  fs.unlinkSync(filePath);

  res.status(200).json({
    status: parsedResult.status,
    data: parsedResult.fields,
    message: parsedResult.debug?.notes || "Receipt processed",
  });
}

function normalizeReceiptText(text: string) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join("\n");
}

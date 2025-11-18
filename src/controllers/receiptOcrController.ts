import HttpErrors from "http-errors";
import fs from "node:fs";
import type { Request, Response } from "express";

import { callChatModel } from "~/services/llmService.js";
import { RECEIPT_OCR_SYSTEM_PROMPT } from "~/prompts/receiptOcr.prompt.js";
import {
  uploadReceiptImage,
  deleteReceiptImage,
} from "~/services/cloudinaryService.js";

const OCR_MODEL = "Qwen/Qwen3-VL-8B-Instruct:novita";

export async function receiptOcrController(
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

  const { imageUrl, publicId } = await uploadReceiptImage(filePath);

  const result = await callChatModel(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: RECEIPT_OCR_SYSTEM_PROMPT,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    OCR_MODEL,
  );

  const clearedResult = result.replaceAll(/```json|```/g, "").trim();
  const parsedResult = JSON.parse(clearedResult);

  fs.unlinkSync(filePath);
  deleteReceiptImage(publicId);

  if (parsedResult.status === "error") {
    throw new HttpErrors.BadRequest(parsedResult.debug.notes);
  }

  res.status(200).json({
    status: parsedResult.status,
    data: parsedResult.fields,
    message: parsedResult.debug.notes || "Receipt processed",
  });
}

import fs from "node:fs/promises";

import type { Request, Response } from "express";
import HttpErrors from "http-errors";

import { RECEIPT_OCR_SYSTEM_PROMPT } from "~/prompts/receiptOcr.prompt.js";
import {
  deleteReceiptImage,
  uploadReceiptImage,
} from "~/services/cloudinaryService.js";
import { callChatModel } from "~/services/llmService.js";
import {
  parseReceiptResponse,
  receiptResponseFormat,
} from "~/services/receiptParser.js";

export async function receiptOcrController(
  req: Request & { file?: Express.Multer.File },
  res: Response,
): Promise<void> {
  if (!req.file) throw new HttpErrors.BadRequest("No file uploaded");

  const { path: filePath, mimetype } = req.file;
  let publicId: string | undefined;
  try {
    if (mimetype !== "image/jpeg") {
      throw new HttpErrors.NotAcceptable("Please, select a JPEG image");
    }
    const uploaded = await uploadReceiptImage(filePath);
    publicId = uploaded.publicId;
    const result = await callChatModel(
      [
        { role: "system", content: RECEIPT_OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract this receipt using the required JSON schema.",
            },
            { type: "image_url", image_url: { url: uploaded.imageUrl } },
          ],
        },
      ],
      process.env.HF_RECEIPT_MODEL || "Qwen/Qwen3-VL-32B-Instruct",
      {
        max_tokens: 8192,
        temperature: 0,
        // Some HF providers do not support JSON Schema. In that case disable
        // constrained output explicitly; local validation still always runs.
        ...(process.env.HF_RECEIPT_STRUCTURED_OUTPUT === "false"
          ? {}
          : { response_format: receiptResponseFormat }),
      },
    );
    const parsedResult = parseReceiptResponse(result);
    if (parsedResult.status === "error") {
      throw new HttpErrors.BadRequest(
        parsedResult.debug.notes || "Unable to read receipt",
      );
    }
    res.status(200).json({
      status: parsedResult.status,
      data: parsedResult.fields,
      message: parsedResult.debug.notes || "Receipt processed",
    });
  } finally {
    const cleanup = await Promise.allSettled([
      fs.rm(filePath, { force: true }),
      ...(publicId ? [deleteReceiptImage(publicId)] : []),
    ]);
    for (const result of cleanup) {
      if (result.status === "rejected") {
        console.error("Failed to clean up receipt image", result.reason);
      }
    }
  }
}

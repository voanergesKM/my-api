import type { Request, Response } from "express";
import HttpErrors from "http-errors";
import { OpenAI } from "openai";

import { RECEIPT_OCR_SYSTEM_PROMPT } from "~/prompts/receiptOcr.prompt.js";
import {
  parseReceiptResponse,
  receiptResponseFormat,
} from "~/services/receiptParser.js";

export async function receiptGeminiController(
  req: Request & { file?: Express.Multer.File },
  res: Response,
): Promise<void> {
  if (!req.file) throw new HttpErrors.BadRequest("No file uploaded");
  if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
    throw new HttpErrors.NotAcceptable(
      "Please, select a JPEG, PNG or WebP image",
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new HttpErrors.InternalServerError(
      "Gemini API key is not configured",
    );
  }

  const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  const response = await client.chat.completions.create({
    model: process.env.GEMINI_RECEIPT_MODEL || "gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: RECEIPT_OCR_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract this receipt using the required JSON schema.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
            },
          },
        ],
      },
    ],
    max_tokens: 8192,
    temperature: 0,
    response_format: receiptResponseFormat,
  });

  if (response.choices?.[0]?.finish_reason === "length") {
    throw new HttpErrors.BadGateway(
      "Model response exceeded the output token limit",
    );
  }
  const parsedResult = parseReceiptResponse(
    response.choices?.[0]?.message?.content ?? "",
  );
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
}

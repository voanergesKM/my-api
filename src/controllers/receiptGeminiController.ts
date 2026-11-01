import type { Request, Response } from "express";
import HttpErrors from "http-errors";
import { OpenAI } from "openai";

import { ProviderError } from "~/middlewares/errorHandler.js";
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
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      req.file.mimetype,
    )
  ) {
    throw new HttpErrors.NotAcceptable(
      "Please, select a JPEG, PNG, WebP image or PDF document",
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new HttpErrors.InternalServerError(
      "Gemini API key is not configured",
    );
  }

  const model = process.env.GEMINI_RECEIPT_MODEL || "gemini-2.5-flash-lite";
  if (req.file.mimetype === "application/pdf") {
    const pdfResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: RECEIPT_OCR_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                {
                  text: "Extract this receipt using the required JSON schema.",
                },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: req.file.buffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: receiptResponseFormat.json_schema.schema,
          },
        }),
      },
    ).catch(() => {
      throw new ProviderError("Gemini", undefined, model);
    });
    if (!pdfResponse.ok)
      throw new ProviderError("Gemini", pdfResponse.status, model);
    let payload: {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
    };
    try {
      payload = (await pdfResponse.json()) as typeof payload;
    } catch {
      throw new HttpErrors.BadGateway("Gemini returned invalid JSON");
    }
    const candidate = payload?.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS")
      throw new HttpErrors.BadGateway(
        "Model response exceeded the output token limit",
      );
    const parsedResult = parseReceiptResponse(
      candidate?.content?.parts?.map(part => part.text ?? "").join("") ?? "",
    );
    if (parsedResult.status === "error")
      throw new HttpErrors.BadRequest(
        parsedResult.debug.notes || "Unable to read receipt",
      );
    res.status(200).json({
      status: parsedResult.status,
      data: parsedResult.fields,
      message: parsedResult.debug.notes || "Receipt processed",
    });
    return;
  }
  const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  const response = await client.chat.completions
    .create({
      model,
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
    })
    .catch((error: unknown) => {
      if (error instanceof OpenAI.APIError) {
        throw new ProviderError("Gemini", error.status, model, error.requestID);
      }
      throw error;
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

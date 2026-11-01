import assert from "node:assert/strict";
import { test } from "node:test";

import { receiptGeminiController } from "../src/controllers/receiptGeminiController.js";

test("Gemini receives the image and schema and returns the existing receipt format", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_RECEIPT_MODEL;
  process.env.GEMINI_API_KEY = "test-only";
  process.env.GEMINI_RECEIPT_MODEL = "test-model";
  let requestBody: Record<string, any> = {};
  let finishReason = "stop";
  let content = JSON.stringify({
    status: "success",
    fields: {
      items: [
        {
          name: "Молоко",
          price: 30,
          quantity: 1,
          category: "food",
          discount: 0,
          total: 30,
        },
      ],
      total: 30,
      currency: "UAH",
      date: null,
    },
    debug: { ocr_quality: "good", notes: "" },
  });
  globalThis.fetch = async (input, init) => {
    assert.match(
      String(input),
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai\/chat\/completions/,
    );
    requestBody = JSON.parse(init?.body as string);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content }, finish_reason: finishReason }],
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  try {
    const req = {
      file: { mimetype: "image/png", buffer: Buffer.from("image") },
    } as Parameters<typeof receiptGeminiController>[0];
    let response: any;
    const res = {
      status(code: number) {
        assert.equal(code, 200);
        return this;
      },
      json(body: unknown) {
        response = body;
      },
    } as unknown as Parameters<typeof receiptGeminiController>[1];
    await receiptGeminiController(req, res);
    assert.equal(requestBody.model, "test-model");
    assert.equal(requestBody.response_format.type, "json_schema");
    assert.equal(
      requestBody.messages[1].content[1].image_url.url,
      "data:image/png;base64,aW1hZ2U=",
    );
    assert.equal(response.data.items[0].name, "Молоко");
    assert.equal(response.data.categories.food, 30);

    const successfulFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(receiptGeminiController(req, res), {
      provider: "Gemini",
      upstreamStatus: 404,
      model: "test-model",
    });
    globalThis.fetch = successfulFetch;

    finishReason = "length";
    await assert.rejects(receiptGeminiController(req, res), { status: 502 });
    finishReason = "stop";
    content = "invalid json";
    await assert.rejects(receiptGeminiController(req, res), { status: 502 });
    await assert.rejects(
      receiptGeminiController(
        { file: { ...req.file!, mimetype: "image/heic" } } as typeof req,
        res,
      ),
      { status: 406 },
    );
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(receiptGeminiController(req, res), { status: 500 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_RECEIPT_MODEL;
    else process.env.GEMINI_RECEIPT_MODEL = originalModel;
  }
});

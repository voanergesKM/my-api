import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { parseReceiptResponse } from "../src/services/receiptParser.js";

function receipt() {
  return {
    status: "success",
    fields: {
      items: [
        {
          name: "Молоко 900 мл",
          price: 33,
          quantity: 2,
          category: "food",
          discount: 10.24,
          total: 55.76,
        },
      ],
      total: 55.76,
      currency: "UAH",
      date: "2026-10-31T00:00:00",
    },
    debug: { ocr_quality: "good", notes: "" },
  };
}

test("discounts and category sums use line totals without double subtraction", () => {
  const result = parseReceiptResponse(JSON.stringify(receipt()));
  assert.equal(result.status, "success");
  assert.equal(result.fields.categories?.food, 55.76);
  assert.equal(result.fields.categories?.other, 0);
});

test("unknown totals remain null, category sums are not silently incomplete", () => {
  const value = receipt();
  const input = JSON.stringify(value).replaceAll(
    '"total":55.76',
    '"total":null',
  );
  const result = parseReceiptResponse(input);
  assert.equal(result.status, "partial");
  assert.equal(result.fields.categories?.food, null);
  assert.equal(result.fields.total, null);
});

test("invalid dates are not replaced by today", () => {
  const value = receipt();
  value.fields.date = "2026-02-30T00:00:00";
  const result = parseReceiptResponse(JSON.stringify(value));
  assert.equal(result.fields.date, null);
  assert.equal(result.status, "partial");
});

test("arithmetic mismatch flags partial and preserves printed amounts", () => {
  const value = receipt();
  value.fields.items[0]!.total = 54;
  const result = parseReceiptResponse(JSON.stringify(value));
  assert.equal(result.status, "partial");
  assert.equal(result.fields.items[0]?.total, 54);
  assert.match(result.debug.notes, /mismatch/);
});

test("rejects malformed JSON, wrong types, missing keys and unexpected fields", () => {
  for (const input of [
    "",
    "{}",
    '{"status":"success"}',
    JSON.stringify(receipt()).replace('"price":33', '"price":"unreadable"'),
    JSON.stringify({ ...receipt(), extra: true }),
  ]) {
    assert.throws(() => parseReceiptResponse(input), { status: 502 });
  }
  assert.equal(
    parseReceiptResponse("```json\n" + JSON.stringify(receipt()) + "\n```")
      .status,
    "success",
  );
});

test("HF controller sends schema and system prompt, cleans local/cloud files on success and failures", async () => {
  let reply = JSON.stringify(receipt());
  let finishReason = "stop";
  let requestBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(init?.body as string);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: reply }, finish_reason: finishReason }],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  process.env.HF_BASE_URL = "https://example.invalid/v1";
  process.env.HF_API_TOKEN = "test-only";
  process.env.HF_RECEIPT_MODEL = "test-model";
  const { v2: cloudinary } = await import("cloudinary");
  const { receiptOcrController } = await import(
    "../src/controllers/receiptOcrController.js"
  );
  const directory = await mkdtemp(join(tmpdir(), "receipt-test-"));
  const upload = cloudinary.uploader.upload;
  const destroy = cloudinary.uploader.destroy;
  let deleted = 0;
  // Replace external storage calls; no images or credentials leave this process.
  cloudinary.uploader.upload = (async () => ({
    secure_url: "https://example.invalid/receipt.jpg",
    public_id: "test-image",
  })) as typeof upload;
  cloudinary.uploader.destroy = (async () => {
    deleted++;
    return { result: "ok" };
  }) as typeof destroy;
  try {
    for (const scenario of [
      "success",
      "invalid-json",
      "truncated",
      "not-receipt",
    ]) {
      const path = join(directory, scenario + ".jpg");
      await writeFile(path, "test image");
      reply =
        scenario === "invalid-json" ? "not json" : JSON.stringify(receipt());
      finishReason = scenario === "truncated" ? "length" : "stop";
      if (scenario === "not-receipt") {
        reply = JSON.stringify({
          status: "error",
          fields: { items: [], total: null, currency: null, date: null },
          debug: { ocr_quality: "poor", notes: "Not a receipt" },
        });
      }
      let response: unknown;
      const req = { file: { path, mimetype: "image/jpeg" } };
      const res = {
        status(code: number) {
          assert.equal(code, 200);
          return this;
        },
        json(body: unknown) {
          response = body;
        },
      };
      const call = receiptOcrController(
        req as Parameters<typeof receiptOcrController>[0],
        res as unknown as Parameters<typeof receiptOcrController>[1],
      );
      if (scenario === "success") {
        await call;
        assert.ok(response);
        assert.equal(requestBody.model, "test-model");
        assert.equal(
          (requestBody.messages as { role: string }[])[0]?.role,
          "system",
        );
        assert.equal(
          (requestBody.response_format as { type: string }).type,
          "json_schema",
        );
      } else {
        await assert.rejects(call, {
          status: scenario === "not-receipt" ? 400 : 502,
        });
      }
      await assert.rejects(access(path));
    }
    assert.equal(deleted, 4);
  } finally {
    cloudinary.uploader.upload = upload;
    cloudinary.uploader.destroy = destroy;
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});

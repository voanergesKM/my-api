import assert from "node:assert/strict";
import test from "node:test";
import { serviceDocumentController } from "../src/controllers/serviceDocumentController.js";

test("calculates totals from all lines, preserving unmatched items and printed discounts", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test";
  const document = {
    date: "2026-11-02",
    odometer: 415000,
    currency: "UAH",
    printedParts: 100,
    printedLabor: 70,
    printedTotal: 170,
    groups: [
      {
        category: "maintenance",
        title: "Filter",
        parts: [
          {
            name: "Filter",
            article: "A1",
            quantity: 2,
            unitPrice: 50,
            total: 100,
          },
        ],
        labor: [],
      },
      {
        category: "repair",
        title: "Alignment",
        parts: [],
        labor: [{ name: "Alignment", total: 80 }],
      },
    ],
  };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(document) }] } },
        ],
      }),
    );
  let result: any;
  const res = {
    json: (value: any) => {
      result = value;
    },
  };
  const req = {
    file: { mimetype: "image/jpeg", buffer: Buffer.from("image") },
  };
  try {
    await serviceDocumentController(req as any, res as any);
    assert.equal(result.data.partsTotal, 100);
    assert.equal(result.data.laborTotal, 80);
    assert.equal(result.data.total, 180);
    assert.equal(result.data.printedTotal, 170);
    assert.equal(result.data.groups[0].labor.length, 0);
    assert.equal(result.data.groups[1].parts.length, 0);
    document.groups[0]!.parts[0]!.total = null as any;
    await serviceDocumentController(req as any, res as any);
    assert.equal(result.data.partsTotal, null);
    assert.equal(result.data.total, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

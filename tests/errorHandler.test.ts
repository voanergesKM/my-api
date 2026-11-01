import assert from "node:assert/strict";
import { test } from "node:test";

import HttpErrors from "http-errors";
import multer from "multer";

import {
  errorHandler,
  ProviderError,
} from "../src/middlewares/errorHandler.js";

test("error handler returns actionable JSON without leaking unexpected errors", () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const handle = (error: unknown) => {
      let status = 0;
      let body: Record<string, unknown> = {};
      const res = {
        locals: { requestId: "test-id" },
        headersSent: false,
        status(value: number) {
          status = value;
          return this;
        },
        json(value: Record<string, unknown>) {
          body = value;
          return this;
        },
      };
      errorHandler(error, {} as never, res as never, () => {});
      return { status, body };
    };
    const upstream = handle(new ProviderError("Gemini", 404, "test-model"));
    assert.equal(upstream.status, 502);
    assert.equal(upstream.body.upstreamStatus, 404);
    assert.match(String(upstream.body.message), /test-model/);
    assert.equal(upstream.body.requestId, "test-id");
    assert.equal(handle(new multer.MulterError("LIMIT_FILE_SIZE")).status, 413);
    assert.equal(
      handle(new HttpErrors.NotAcceptable("Unsupported image")).body.error,
      "Unsupported image",
    );
    assert.equal(
      handle(new Error("secret internal data")).body.error,
      "Internal server error",
    );
  } finally {
    console.error = originalError;
  }
});

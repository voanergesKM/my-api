import { randomUUID } from "node:crypto";

import type { ErrorRequestHandler, RequestHandler } from "express";
import HttpErrors from "http-errors";
import multer from "multer";

export const requestId: RequestHandler = (_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  next();
};

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly upstreamStatus: number | undefined,
    public readonly model: string,
    public readonly providerRequestId?: string | null,
  ) {
    super(
      `${provider} request failed${upstreamStatus ? ` (HTTP ${upstreamStatus})` : " (connection error)"}`,
    );
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) return next(error);
  const id = res.locals.requestId as string;
  if (error instanceof ProviderError) {
    console.error("Upstream provider error", {
      requestId: id,
      provider: error.provider,
      upstreamStatus: error.upstreamStatus,
      model: error.model,
      providerRequestId: error.providerRequestId,
    });
    const message =
      error.upstreamStatus === 404
        ? `${error.provider} returned HTTP 404 for model ${error.model}. Check the model ID, availability and provider endpoint.`
        : `${error.provider} request failed${error.upstreamStatus ? ` (HTTP ${error.upstreamStatus})` : ": connection error"}.`;
    return res.status(502).json({
      error: message,
      message,
      code: "UPSTREAM_ERROR",
      requestId: id,
      provider: error.provider,
      upstreamStatus: error.upstreamStatus ?? null,
      model: error.model,
    });
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "File exceeds the 10 MB limit"
        : error.message;
    return res
      .status(status)
      .json({ error: message, message, code: error.code, requestId: id });
  }
  const status = HttpErrors.isHttpError(error) ? error.statusCode : 500;
  const message =
    HttpErrors.isHttpError(error) && error.expose
      ? error.message
      : "Internal server error";
  if (status >= 500)
    console.error("Request failed", { requestId: id, status, error });
  return res.status(status).json({
    error: message,
    message,
    code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
    requestId: id,
  });
};

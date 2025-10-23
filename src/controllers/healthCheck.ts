import type { Request, Response } from "express";

export async function healthCheckHandler(request: Request, response: Response) {
  const body = {
    message: "OK",
    timestamp: Date.now(),
    uptime: process.uptime(),
  };
  response.json(body);
}

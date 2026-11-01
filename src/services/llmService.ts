import dotenv from "dotenv";
import { OpenAI } from "openai";
dotenv.config();

import HttpErrors from "http-errors";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

import { ProviderError } from "~/middlewares/errorHandler.js";

const client = new OpenAI({
  baseURL: process.env.HF_BASE_URL || "https://router.huggingface.co/v1",
  apiKey: process.env.HF_API_TOKEN,
});

export async function callChatModel(
  messages: ChatCompletionMessageParam[],
  model = process.env.HF_MODEL || "gpt2",
  options: Pick<
    ChatCompletionCreateParamsNonStreaming,
    "response_format" | "max_tokens" | "temperature"
  > = {},
) {
  const resp = await client.chat.completions
    .create({ model, messages, ...options })
    .catch((error: unknown) => {
      if (error instanceof OpenAI.APIError) {
        throw new ProviderError(
          "Hugging Face",
          error.status,
          model,
          error.requestID,
        );
      }
      throw error;
    });
  if (resp.choices?.[0]?.finish_reason === "length") {
    throw new HttpErrors.BadGateway(
      "Model response exceeded the output token limit",
    );
  }
  return resp.choices?.[0]?.message?.content?.trim() ?? "";
}

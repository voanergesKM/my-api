import dotenv from "dotenv";
import { OpenAI } from "openai";
dotenv.config();

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI({
  baseURL: process.env.HF_BASE_URL || "https://router.huggingface.co/v1",
  apiKey: process.env.HF_API_TOKEN,
});

export async function callChatModel(
  messages: ChatCompletionMessageParam[],
  model = process.env.HF_MODEL || "gpt2",
) {
  const resp = await client.chat.completions.create({ model, messages });
  return resp.choices?.[0]?.message?.content?.trim() ?? "";
}

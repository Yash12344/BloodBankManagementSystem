import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Thin wrapper around the Anthropic SDK for the optional AI features. Everything here is
 * gated behind the FEATURE_AI flag AND a configured API key — when either is missing the
 * LLM-backed endpoints degrade to deterministic fallbacks rather than failing.
 */
export function aiEnabled(): boolean {
  return env.FEATURE_AI && !!env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export interface GenerateInput {
  system: string;
  prompt: string;
  maxTokens?: number;
}

/**
 * Single-shot text generation. Returns the concatenated text blocks. Throws if AI is
 * disabled — callers should check `aiEnabled()` first and provide a fallback.
 */
export async function generateText({ system, prompt, maxTokens = 1024 }: GenerateInput): Promise<string> {
  if (!aiEnabled()) throw new Error("AI features are disabled");

  const response = await getClient().messages.create({
    model: env.AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  // Content is a discriminated union — narrow to text blocks before reading .text.
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  logger.debug({ model: env.AI_MODEL, outputTokens: response.usage.output_tokens }, "ai generateText");
  return text;
}

/** Extracts the first JSON object from a model response (handles fenced code blocks). */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

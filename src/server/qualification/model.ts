import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createSampleDraftModel } from "../drafts/sample-model";
import { createSampleModel } from "./sample-model";
import type { ModelClient } from "./types";

const MAX_OUTPUT_TOKENS = 4_000;

function createClaudeModel(apiKey: string, modelName: string): ModelClient {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return {
    provider: "anthropic",
    modelName,
    async complete({ system, user, schema }) {
      const response = await client.messages.create({
        model: modelName,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
        output_config: {
          format: { type: "json_schema", schema: schema as Record<string, unknown> },
        },
      });
      const block = response.content.find((item) => item.type === "text");
      return {
        stopReason: response.stop_reason,
        text: block?.type === "text" ? block.text : "",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  };
}

const isLocal = (url: string | undefined) =>
  /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url ?? "");

// Nothing can spend money unless a key and a model are both set on purpose.
export function resolveModel(env: Record<string, string | undefined>): ModelClient | null {
  if (env.QUALIFICATION_MODE === "sample") {
    return isLocal(env.NEXT_PUBLIC_SUPABASE_URL) ? createSampleModel() : null;
  }
  if (env.QUALIFICATION_MODE === "live" && env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) {
    return createClaudeModel(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
  }
  return null;
}

export function resolveDraftModel(env: Record<string, string | undefined>): ModelClient | null {
  if (env.QUALIFICATION_MODE === "sample") {
    return isLocal(env.NEXT_PUBLIC_SUPABASE_URL) ? createSampleDraftModel() : null;
  }
  return resolveModel(env);
}

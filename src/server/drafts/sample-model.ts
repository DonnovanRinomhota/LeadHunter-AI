import type { ModelClient } from "../qualification/types";

// A free stand-in for testing the review flow. It fills a fixed template and makes no API call.
export function createSampleDraftModel(): ModelClient {
  return {
    provider: "sample",
    modelName: "sample-template-v1",
    async complete({ user }) {
      const input = JSON.parse(user) as { matchedServices: string[] };
      const service = input.matchedServices[0] ?? "our services";
      const message = `Hello,

This is a sample draft for testing the review steps, not written by Claude. I saw your post about a process you would like to improve, and ${service} could help.

Would a short call be useful? If you would rather not hear from us, just say so and we won't contact you again.

[Your name]
Spiritus Agentic Solutions`;
      return { stopReason: "end_turn", text: JSON.stringify({ message }), inputTokens: 0, outputTokens: 0 };
    },
  };
}

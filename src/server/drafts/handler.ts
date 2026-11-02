import { z } from "zod";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyRequest } from "@/contracts/internal-auth";
import type { ModelClient } from "../qualification/types";
import { generateDraft, type DraftResult, type DraftStore } from "./generate";

const requestSchema = z.strictObject({
  limit: z.number().int().min(1).max(10).default(5),
});

const reply = (status: number, body: unknown) => Response.json(body, { status });

export type DraftDependencies = {
  secret: string | undefined;
  dailyLimit: number;
  getModel: () => ModelClient | null;
  getStore: () => DraftStore;
  now: () => Date;
};

export async function handleDraftRequest(request: Request, deps: DraftDependencies): Promise<Response> {
  if (!deps.secret) {
    console.error("Draft generation is not configured");
    return reply(500, { error: "Server is not configured" });
  }
  const rawBody = await request.text();
  const verified = verifyRequest({
    secret: deps.secret,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
    rawBody,
    now: deps.now(),
  });
  if (!verified) return reply(401, { error: "Invalid signature" });

  let body: unknown;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return reply(400, { error: "Body must be JSON" });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return reply(422, { error: "limit must be from 1 to 10" });

  const model = deps.getModel();
  if (!model) return reply(503, { error: "Draft generation is turned off" });

  try {
    const store = deps.getStore();
    const startOfDay = new Date(deps.now());
    startOfDay.setUTCHours(0, 0, 0, 0);
    const remaining = Math.max(0, deps.dailyLimit - (await store.countDraftsSince(startOfDay)));
    if (remaining === 0) {
      return reply(200, { mode: model.provider, capped: true, processed: 0, results: [] });
    }

    const work = await store.listReady(Math.min(parsed.data.limit, remaining));
    const results: DraftResult[] = [];
    for (const item of work) {
      results.push(await generateDraft(item, { store, model }));
    }
    return reply(200, { mode: model.provider, capped: false, processed: results.length, results });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Draft generation failed");
    return reply(500, { error: "Drafts could not be generated" });
  }
}

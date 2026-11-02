import { z } from "zod";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRequest,
} from "@/contracts/internal-auth";
import { qualifyLead } from "./qualify";
import type { ModelClient, QualificationStore, QualifyResult } from "./types";

const requestSchema = z.strictObject({
  limit: z.number().int().min(1).max(10).default(5),
});

const reply = (status: number, body: unknown) => Response.json(body, { status });

export type QualifyDependencies = {
  secret: string | undefined;
  dailyLimit: number;
  getModel: () => ModelClient | null;
  getStore: () => QualificationStore;
  now: () => Date;
};

export async function handleQualifyRequest(
  request: Request,
  deps: QualifyDependencies,
): Promise<Response> {
  if (!deps.secret) {
    console.error("Lead qualification is not configured");
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

  // Checked before any lead is claimed, so an unconfigured server changes nothing.
  const model = deps.getModel();
  if (!model) return reply(503, { error: "Scoring is turned off" });

  try {
    const store = deps.getStore();
    const startOfDay = new Date(deps.now());
    startOfDay.setUTCHours(0, 0, 0, 0);
    const used = await store.countAnalysesSince(startOfDay);
    const remaining = Math.max(0, deps.dailyLimit - used);
    if (remaining === 0) {
      return reply(200, { mode: model.provider, capped: true, processed: 0, results: [] });
    }

    const claimed = await store.claim(Math.min(parsed.data.limit, remaining));
    const results: QualifyResult[] = [];
    for (const { lead_id: leadId } of claimed) {
      results.push(await qualifyLead(leadId, { store, model, now: deps.now }));
    }
    return reply(200, {
      mode: model.provider,
      capped: false,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Qualification failed");
    return reply(500, { error: "Leads could not be scored" });
  }
}

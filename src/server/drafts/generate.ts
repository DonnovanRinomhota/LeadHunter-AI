import type { ModelClient } from "../qualification/types";
import {
  buildDraftSystemPrompt,
  buildDraftUserMessage,
  draftJsonSchema,
  draftOutputSchema,
  DRAFT_PROMPT_VERSION,
} from "./prompt";
import type { PromptProfile } from "../qualification/prompt";

export type DraftWork = { lead_id: string; analysis_id: string; workspace_id: string };

export type DraftContext = {
  channel: string;
  organisationName: string | null;
  countryCode: string | null;
  problemSummary: string | null;
  sourceText: string;
  matchedServices: { service_name: string; description: string | null }[];
  profile: PromptProfile;
};

export type DraftStore = {
  listReady(limit: number): Promise<DraftWork[]>;
  countDraftsSince(since: Date): Promise<number>;
  loadContext(work: DraftWork): Promise<DraftContext | null>;
  createDraft(work: DraftWork, channel: string, message: string, promptVersion: string): Promise<string>;
  recordProblem(leadId: string, message: string): Promise<void>;
};

export type DraftResult =
  | { leadId: string; outcome: "drafted"; draftId: string }
  | { leadId: string; outcome: "failed"; error: string };

class DraftFailure extends Error {}

export function parseDraftReply(reply: { stopReason: string | null; text: string }): string {
  if (reply.stopReason === "refusal") throw new DraftFailure("Claude declined to write this draft.");
  if (reply.stopReason === "max_tokens") throw new DraftFailure("Claude's draft was cut off before it finished.");
  let json: unknown;
  try {
    json = JSON.parse(reply.text);
  } catch {
    throw new DraftFailure("Claude's draft wasn't valid JSON.");
  }
  const parsed = draftOutputSchema.safeParse(json);
  if (!parsed.success) throw new DraftFailure("Claude's draft didn't match the expected format.");
  return parsed.data.message;
}

export async function generateDraft(
  work: DraftWork,
  deps: { store: DraftStore; model: ModelClient },
): Promise<DraftResult> {
  const { store, model } = deps;
  try {
    const context = await store.loadContext(work);
    if (!context) throw new DraftFailure("The lead no longer exists.");

    const reply = await model.complete({
      system: buildDraftSystemPrompt(context.profile, context.matchedServices),
      user: buildDraftUserMessage({
        channel: context.channel,
        organisationName: context.organisationName,
        countryCode: context.countryCode,
        problemSummary: context.problemSummary,
        sourceText: context.sourceText,
        matchedServices: context.matchedServices.map((service) => service.service_name),
      }),
      schema: draftJsonSchema(),
      serviceIds: [],
    });
    const message = parseDraftReply(reply);
    const version = model.provider === "sample" ? `sample:${DRAFT_PROMPT_VERSION}` : DRAFT_PROMPT_VERSION;
    const draftId = await store.createDraft(work, context.channel, message, version);
    return { leadId: work.lead_id, outcome: "drafted", draftId };
  } catch (error) {
    const known = error instanceof DraftFailure;
    const message = known ? error.message : "The draft failed because of a service error.";
    if (!known) console.error(error instanceof Error ? error.message : "Draft failed");
    try {
      await store.recordProblem(work.lead_id, message);
    } catch (recordError) {
      console.error(recordError instanceof Error ? recordError.message : "Could not record problem");
    }
    return { leadId: work.lead_id, outcome: "failed", error: message };
  }
}

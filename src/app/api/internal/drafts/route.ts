import { handleDraftRequest } from "@/server/drafts/handler";
import { createDraftStore } from "@/server/drafts/store";
import { resolveDraftModel } from "@/server/qualification/model";

const DEFAULT_DAILY_LIMIT = 50;

export function POST(request: Request) {
  const configured = Number(process.env.DRAFT_DAILY_LIMIT);
  return handleDraftRequest(request, {
    secret: process.env.N8N_TO_APP_SECRET,
    dailyLimit: Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT,
    getModel: () => resolveDraftModel(process.env),
    getStore: createDraftStore,
    now: () => new Date(),
  });
}

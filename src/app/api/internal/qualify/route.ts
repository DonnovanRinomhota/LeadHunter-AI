import { handleQualifyRequest } from "@/server/qualification/handler";
import { resolveModel } from "@/server/qualification/model";
import { createQualificationStore } from "@/server/qualification/store";

const DEFAULT_DAILY_LIMIT = 50;

export function POST(request: Request) {
  const configured = Number(process.env.QUALIFICATION_DAILY_LIMIT);
  return handleQualifyRequest(request, {
    secret: process.env.N8N_TO_APP_SECRET,
    dailyLimit: Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT,
    getModel: () => resolveModel(process.env),
    getStore: createQualificationStore,
    now: () => new Date(),
  });
}

import { handleIngestRequest } from "@/server/ingest-handler";
import type { IngestRpcClient } from "@/server/ingest";
import { createServerClient } from "@/server/supabase";

export function POST(request: Request) {
  return handleIngestRequest(request, {
    secret: process.env.N8N_TO_APP_SECRET,
    workspaceId: process.env.LEADHUNTER_WORKSPACE_ID,
    getClient: () => createServerClient() as unknown as IngestRpcClient,
    now: () => new Date(),
  });
}

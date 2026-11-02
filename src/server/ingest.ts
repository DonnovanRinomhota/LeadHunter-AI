import { createHash } from "node:crypto";
import type { LeadIngest, LeadIngestResponse } from "@/contracts/ingest";
import { leadIngestResponseSchema } from "@/contracts/ingest";

const TRACKING_PARAMETER = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

// Treats trivially different links to the same page as one page.
export function canonicalUrl(url: string | null): string | null {
  if (url === null) return null;
  const parsed = new URL(url);
  parsed.hash = "";
  for (const name of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMETER.test(name)) parsed.searchParams.delete(name);
  }
  parsed.searchParams.sort();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString();
}

export function contentHash(content: string): string {
  const normalised = content.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalised).digest("hex");
}

export type IngestRpcClient = {
  rpc(
    name: "ingest_lead",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function ingestLead(
  client: IngestRpcClient,
  workspaceId: string,
  lead: LeadIngest,
): Promise<LeadIngestResponse> {
  const { data, error } = await client.rpc("ingest_lead", {
    p_workspace: workspaceId,
    p_idempotency_key: lead.idempotencyKey,
    p_source_type: lead.sourceType,
    p_source_config_id: lead.sourceConfigId,
    p_source_record_id: lead.sourceRecordId,
    p_source_url: lead.sourceUrl,
    p_canonical_url: canonicalUrl(lead.sourceUrl),
    p_author_handle: lead.authorHandle,
    p_organisation_name: lead.organisationName,
    p_country_code: lead.countryCode,
    p_contact_channel: lead.contactChannel,
    p_contact_value: lead.contactValue,
    p_original_content: lead.originalContent,
    p_content_hash: contentHash(lead.originalContent),
    p_published_at: lead.publishedAt,
  });
  if (error) throw new Error(`ingest_lead failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return leadIngestResponseSchema.parse({
    outcome: row?.outcome,
    leadId: row?.lead_id,
  });
}

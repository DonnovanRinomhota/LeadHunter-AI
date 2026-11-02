import "server-only";
import type { PromptProfile } from "../qualification/prompt";
import { createServerClient } from "../supabase";
import type { DraftStore, DraftWork } from "./generate";

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function createDraftStore(): DraftStore {
  const db = createServerClient();
  return {
    async listReady(limit) {
      const { data, error } = await db.rpc("list_leads_ready_for_draft", { p_limit: limit });
      check(error, "List draft queue");
      return (data ?? []) as DraftWork[];
    },
    async countDraftsSince(since) {
      const { count, error } = await db
        .from("outreach_drafts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString());
      check(error, "Count drafts");
      return count ?? 0;
    },
    async loadContext(work) {
      const { data: lead, error } = await db
        .from("leads")
        .select("organisation_name, country_code, contact_channel, original_content")
        .eq("id", work.lead_id)
        .maybeSingle();
      check(error, "Load lead");
      if (!lead) return null;

      const [analysis, matches, profile] = await Promise.all([
        db.from("lead_analyses").select("problem_summary").eq("id", work.analysis_id).maybeSingle(),
        db.from("lead_analysis_services").select("service_id").eq("analysis_id", work.analysis_id),
        db
          .from("business_profiles")
          .select("company_name, target_geographies, target_industries, excluded_segments, ideal_customer_profile")
          .eq("workspace_id", work.workspace_id)
          .maybeSingle(),
      ]);
      check(analysis.error ?? matches.error ?? profile.error, "Load draft details");

      const ids = (matches.data ?? []).map((match) => match.service_id);
      const services = ids.length
        ? await db.from("services").select("service_name, description").in("id", ids)
        : { data: [], error: null };
      check(services.error, "Load services");

      return {
        channel: lead.contact_channel ?? "email",
        organisationName: lead.organisation_name,
        countryCode: lead.country_code,
        problemSummary: analysis.data?.problem_summary ?? null,
        sourceText: lead.original_content,
        matchedServices: services.data ?? [],
        profile: profile.data as PromptProfile,
      };
    },
    async createDraft(work, channel, message, promptVersion) {
      const { data, error } = await db.rpc("create_outreach_draft", {
        p_lead: work.lead_id,
        p_analysis: work.analysis_id,
        p_channel: channel,
        p_message: message,
        p_prompt_version: promptVersion,
      });
      check(error, "Save draft");
      return String(data);
    },
    async recordProblem(leadId, message) {
      const { error } = await db.from("leads").update({ qualification_last_error: message }).eq("id", leadId);
      check(error, "Record problem");
    },
  };
}

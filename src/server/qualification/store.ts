import "server-only";
import { createServerClient } from "../supabase";
import type { PromptProfile, PromptService } from "./prompt";
import type { LoadedLead, QualificationStore } from "./types";

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function createQualificationStore(): QualificationStore {
  const db = createServerClient();
  return {
    async loadLead(leadId) {
      const { data, error } = await db
        .from("leads")
        .select("id, workspace_id, status, source_type, source_url, organisation_name, country_code, published_at, original_content")
        .eq("id", leadId)
        .maybeSingle();
      check(error, "Load lead");
      return data as LoadedLead | null;
    },
    async loadServices(workspaceId) {
      const { data, error } = await db
        .from("services")
        .select("id, service_name, description, capability_level, is_priority")
        .eq("workspace_id", workspaceId)
        .eq("active", true);
      check(error, "Load services");
      return (data ?? []) as PromptService[];
    },
    async loadProfile(workspaceId) {
      const { data, error } = await db
        .from("business_profiles")
        .select("company_name, target_geographies, target_industries, excluded_segments, ideal_customer_profile")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      check(error, "Load profile");
      return data as PromptProfile;
    },
    async saveAnalysis({ lead, output, recency, provider, modelName, promptVersion, inputTokens, outputTokens }) {
      const { data, error } = await db
        .from("lead_analyses")
        .insert({
          workspace_id: lead.workspace_id,
          lead_id: lead.id,
          model_provider: provider,
          model_name: modelName,
          prompt_version: promptVersion,
          is_business_opportunity: output.isBusinessOpportunity,
          lead_summary: output.leadSummary,
          problem_summary: output.problemSummary,
          organisation_name: output.organisationName,
          requirements: output.requirements,
          evidence: output.evidence,
          missing_information: output.missingInformation,
          fit_assessment: output.fitAssessment,
          buying_intent: output.buyingIntent,
          urgency: output.urgency,
          budget_min: output.budget.min,
          budget_max: output.budget.max,
          budget_currency: output.budget.currency,
          confidence: output.confidence,
          score_service_relevance: output.scores.serviceRelevance,
          score_buying_intent: output.scores.buyingIntent,
          score_project_clarity: output.scores.projectClarity,
          score_capability_match: output.scores.capabilityMatch,
          score_budget_evidence: output.scores.budgetEvidence,
          score_recency: recency,
          disqualifier: output.disqualifier,
          recommended_action: output.recommendedAction,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          raw_structured_output: output,
        })
        .select("id")
        .single();
      check(error, "Save analysis");

      if (output.serviceMatches.length > 0) {
        const { error: matchError } = await db.from("lead_analysis_services").insert(
          output.serviceMatches.map((match) => ({
            workspace_id: lead.workspace_id,
            analysis_id: data?.id,
            service_id: match.serviceId,
            evidence: match.evidence,
          })),
        );
        check(matchError, "Save service matches");
      }
    },
    async transition(leadId, to, reason) {
      const { error } = await db.rpc("transition_lead", { p_lead: leadId, p_to: to, p_reason: reason });
      check(error, "Move lead");
    },
    async recordFailure(leadId, message) {
      const { error } = await db.rpc("record_qualification_failure", { p_lead: leadId, p_error: message });
      check(error, "Record failure");
    },
    async claim(limit) {
      const { data, error } = await db.rpc("claim_leads_for_qualification", { p_limit: limit });
      check(error, "Claim leads");
      return (data ?? []) as { lead_id: string; workspace_id: string }[];
    },
    async countAnalysesSince(since) {
      const { count, error } = await db
        .from("lead_analyses")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString());
      check(error, "Count analyses");
      return count ?? 0;
    },
  };
}

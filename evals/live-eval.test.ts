import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { recencyScore, totalScore } from "@/contracts/qualification";
import { resolveModel } from "@/server/qualification/model";
import { buildSystemPrompt, buildUserMessage, type PromptService } from "@/server/qualification/prompt";
import { parseReply, scoringSchema } from "@/server/qualification/qualify";

type EvalLead = {
  id: string;
  kind: string;
  content: string;
  organisation: string | null;
  country: string;
  expectedActions: string[];
  minScore: number;
  maxScore: number;
};

const SERVICES: PromptService[] = [
  { id: "00000000-0000-4000-8000-000000000001", service_name: "Agentic Workflows", description: "Reduce repetitive administrative work.", capability_level: "confirmed", is_priority: true },
  { id: "00000000-0000-4000-8000-000000000002", service_name: "Automation & Integration", description: "Streamline processes and connect existing systems.", capability_level: "confirmed", is_priority: true },
  { id: "00000000-0000-4000-8000-000000000003", service_name: "AI Knowledge Operations", description: "Improve access to business information.", capability_level: "confirmed", is_priority: true },
];

const PROFILE = {
  company_name: "Spiritus Agentic Solutions",
  target_geographies: ["ZW", "ZA"],
  target_industries: ["consultancies", "accounting firms", "business services"],
  excluded_segments: [],
  ideal_customer_profile: {
    segment: "Mid-sized professional services firms",
    staff_min: 20,
    staff_max: 200,
  },
};

const REQUIRED_AGREEMENT = 0.8;

it("agrees with the team's labels", async () => {
  const model = resolveModel(process.env);
  if (!model) throw new Error("Set QUALIFICATION_MODE in .env.local first.");

  const leads: EvalLead[] = JSON.parse(readFileSync("evals/sample-leads.json", "utf8"));
  const serviceIds = SERVICES.map((service) => service.id);
  let matched = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const lead of leads) {
    const reply = await model.complete({
      system: buildSystemPrompt(SERVICES, PROFILE),
      user: buildUserMessage({
        source_type: "eval",
        source_url: null,
        organisation_name: lead.organisation,
        country_code: lead.country,
        published_at: null,
        original_content: lead.content,
      }),
      schema: scoringSchema(serviceIds),
      serviceIds,
    });
    inputTokens += reply.inputTokens;
    outputTokens += reply.outputTokens;

    let line: string;
    try {
      const output = parseReply(reply, lead.content, serviceIds);
      const total = totalScore(output.scores, recencyScore(null, new Date()));
      const ok =
        lead.expectedActions.includes(output.recommendedAction) &&
        total >= lead.minScore &&
        total <= lead.maxScore;
      if (ok) matched += 1;
      line = `${ok ? "PASS" : "MISS"} ${lead.id}: ${output.recommendedAction}, ${total}`;
    } catch (error) {
      line = `FAIL ${lead.id}: ${error instanceof Error ? error.message : "error"}`;
    }
    console.log(line);
  }

  const agreement = matched / leads.length;
  console.log(`Agreement ${matched} of ${leads.length}. Tokens: ${inputTokens} in, ${outputTokens} out.`);
  if (model.provider !== "sample") expect(agreement).toBeGreaterThanOrEqual(REQUIRED_AGREEMENT);
});

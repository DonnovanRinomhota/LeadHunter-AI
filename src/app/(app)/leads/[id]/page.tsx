import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ScoreTrack } from "@/components/score-track";
import type { LeadStatus } from "@/contracts/lead-state";
import { formatDate, safeWebUrl, STATUS_LABELS } from "@/lib/lead-labels";
import { createSessionClient, getCurrentMember } from "@/server/session";

export const metadata: Metadata = { title: "Lead" };

type Props = PageProps<"/leads/[id]">;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

type Evidence = { claim: string; quote: string };

type AnalysisRow = {
  model_provider: string;
  prompt_version: string;
  lead_summary: string | null;
  fit_assessment: string;
  buying_intent: string;
  confidence: number;
  recommended_action: string;
  disqualifier: string | null;
  evidence: Evidence[];
  missing_information: string[];
  score_service_relevance: number;
  score_buying_intent: number;
  score_project_clarity: number;
  score_capability_match: number;
  score_budget_evidence: number;
  score_recency: number;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  review: "Review for contact",
  research: "Research only. No buying signal yet",
  reject: "Reject",
  needs_information: "Needs more information",
  compliance_review: "Check whether contact is appropriate",
};

function Assessment({
  analysis,
  matches,
  services,
}: {
  analysis: AnalysisRow;
  matches: { service_id: string; evidence: Evidence[] }[];
  services: { id: string; service_name: string }[];
}) {
  const rows: [string, number, number][] = [
    ["Relevance to our services", analysis.score_service_relevance, 25],
    ["Buying intent", analysis.score_buying_intent, 25],
    ["Capability match", analysis.score_capability_match, 20],
    ["Project clarity", analysis.score_project_clarity, 15],
    ["Budget evidence", analysis.score_budget_evidence, 10],
    ["Recency", analysis.score_recency, 5],
  ];
  const serviceName = (id: string) =>
    services.find((service) => service.id === id)?.service_name ?? "Unknown service";

  return (
    <div className="mt-8">
      <h2 className="text-2xl">AI assessment</h2>
      <p className="mt-1 text-sm text-muted">
        A suggestion to help you decide. Check it against the source above.
      </p>
      {analysis.model_provider === "sample" ? (
        <p role="status" className="mt-3 rounded-sm bg-note-wash p-3">
          Sample score from keyword rules for testing, not from Claude.
        </p>
      ) : null}
      {analysis.lead_summary ? <p className="mt-3 max-w-prose">{analysis.lead_summary}</p> : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Fact label="Recommended next step">
          {ACTION_LABELS[analysis.recommended_action] ?? analysis.recommended_action}
        </Fact>
        <Fact label="Confidence">{Math.round(analysis.confidence * 100)}%</Fact>
        <Fact label="Fit with who we serve">{analysis.fit_assessment}</Fact>
        <Fact label="Buying signal">{analysis.buying_intent}</Fact>
        {analysis.disqualifier ? <Fact label="Disqualified because">{analysis.disqualifier}</Fact> : null}
      </dl>

      <h3 className="mt-6 font-display text-lg font-semibold">Why it got this score</h3>
      <table className="mt-2 w-full max-w-md border-collapse text-left">
        <tbody>
          {rows.map(([label, value, max]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-1.5 pr-4 font-normal">{label}</th>
              <td className="py-1.5 text-right tabular-nums">{value} of {max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {analysis.evidence.length > 0 ? (
        <>
          <h3 className="mt-6 font-display text-lg font-semibold">Evidence from the source</h3>
          <ul className="mt-2 flex max-w-prose flex-col gap-3">
            {analysis.evidence.map((item, index) => (
              <li key={index}>
                <p>{item.claim}</p>
                <q className="break-words text-muted">{item.quote}</q>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {matches.length > 0 ? (
        <>
          <h3 className="mt-6 font-display text-lg font-semibold">Matching services</h3>
          <ul className="mt-2 flex max-w-prose flex-col gap-2">
            {matches.map((match) => (
              <li key={match.service_id}>
                <p>{serviceName(match.service_id)}</p>
                {match.evidence.map((item, index) => (
                  <q key={index} className="block break-words text-muted">{item.quote}</q>
                ))}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {analysis.missing_information.length > 0 ? (
        <>
          <h3 className="mt-6 font-display text-lg font-semibold">Still unknown</h3>
          <ul className="mt-2 list-disc pl-5">
            {analysis.missing_information.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      ) : null}
    </div>
  );
}

async function LeadDetail({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const member = await getCurrentMember();
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createSessionClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, organisation_name, original_content, source_type, source_url, country_code, contact_channel, contact_value, status, lead_score, published_at, discovered_at, qualification_last_error",
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (!lead) notFound();

  const sourceUrl = safeWebUrl(lead.source_url);
  const { data: analysis } = await supabase
    .from("lead_analyses")
    .select(
      "id, model_provider, prompt_version, lead_summary, fit_assessment, buying_intent, confidence, recommended_action, disqualifier, evidence, missing_information, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, created_at",
    )
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: matches } = analysis
    ? await supabase
        .from("lead_analysis_services")
        .select("service_id, evidence")
        .eq("analysis_id", analysis.id)
    : { data: null };
  const { data: services } = analysis
    ? await supabase.from("services").select("id, service_name").eq("workspace_id", member.workspaceId)
    : { data: null };
  return (
    <>
      <p><Link href="/leads" className="text-link">Back to leads</Link></p>
      <h1 className="mt-4 text-4xl">{lead.organisation_name ?? "Organisation unknown"}</h1>

      {query.duplicate ? (
        <p role="status" className="mt-4 rounded-sm bg-note-wash p-3">
          This lead is already in LeadHunter, so nothing new was added.
        </p>
      ) : null}
      {query.added ? (
        <p role="status" className="mt-4 rounded-sm bg-note-wash p-3">Lead added.</p>
      ) : null}
      {lead.qualification_last_error ? (
        <p role="alert" className="mt-4 rounded-sm bg-alert-wash p-3 text-alert">
          Scoring failed: {lead.qualification_last_error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <h2 className="text-2xl">What the source says</h2>
          <p className="mt-1 text-sm text-muted">Shown exactly as received. It has not been checked.</p>
          <blockquote className="mt-3 max-w-prose whitespace-pre-wrap break-words border-l-4 border-msasa pl-4">
            {lead.original_content}
          </blockquote>
          {analysis ? (
            <Assessment analysis={analysis as AnalysisRow} matches={matches ?? []} services={services ?? []} />
          ) : (
            <p className="mt-8 text-muted">This lead hasn&apos;t been assessed yet.</p>
          )}
        </section>
        <section>
          <h2 className="text-2xl">Score</h2>
          <div className="mt-3"><ScoreTrack score={lead.lead_score} /></div>
          <dl className="mt-6 flex flex-col gap-3">
            <Fact label="Status">{STATUS_LABELS[lead.status as LeadStatus]}</Fact>
            <Fact label="Source">{lead.source_type}</Fact>
            {sourceUrl ? (
              <Fact label="Source web address">
                <a className="text-link" href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {sourceUrl}
                </a>
              </Fact>
            ) : null}
            <Fact label="Country">{lead.country_code ?? "Unknown"}</Fact>
            <Fact label="Contact">
              {lead.contact_value
                ? `${lead.contact_value}${lead.contact_channel ? ` (${lead.contact_channel})` : ""}`
                : "Unknown"}
            </Fact>
            <Fact label="Published">{formatDate(lead.published_at)}</Fact>
            <Fact label="Added to LeadHunter">{formatDate(lead.discovered_at)}</Fact>
          </dl>
        </section>
      </div>
    </>
  );
}

export default function LeadPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-muted">Loading lead</p>}>
      <LeadDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

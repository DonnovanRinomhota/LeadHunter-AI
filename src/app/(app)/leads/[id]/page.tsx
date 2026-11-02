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

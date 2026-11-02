import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { findDraftFlags } from "@/lib/draft-flags";
import { createSessionClient, getCurrentMember } from "@/server/session";

export const metadata: Metadata = { title: "Drafts to review" };

async function DraftList() {
  const member = await getCurrentMember();
  const supabase = await createSessionClient();
  const { data: drafts, error } = await supabase
    .from("outreach_drafts")
    .select("id, lead_id, status, channel, message, created_at")
    .eq("workspace_id", member.workspaceId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error(`Draft list failed: ${error.message}`);
    return (
      <p role="alert" className="rounded-sm bg-alert-wash p-3 text-alert">
        The drafts couldn&apos;t be loaded. Refresh the page to try again.
      </p>
    );
  }
  if (!drafts || drafts.length === 0) {
    return (
      <p className="mt-6">
        No drafts need attention. New ones appear here once a qualified lead has a draft.
      </p>
    );
  }

  const { data: leads } = await supabase
    .from("leads")
    .select("id, organisation_name, source_url")
    .in("id", drafts.map((draft) => draft.lead_id));
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("website_url")
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  const leadOf = (id: string) => leads?.find((lead) => lead.id === id);

  return (
    <ul className="mt-6 border-t border-line">
      {drafts.map((draft) => {
        const lead = leadOf(draft.lead_id);
        const flags = findDraftFlags(draft.message, [profile?.website_url ?? null, lead?.source_url ?? null]);
        return (
          <li key={draft.id} className="border-b border-line">
            <Link
              href={`/leads/${draft.lead_id}`}
              className="grid gap-x-6 gap-y-1 py-4 hover:bg-note-wash md:grid-cols-[minmax(0,1fr)_9rem_9rem] md:items-center md:px-2"
            >
              <div className="min-w-0">
                <p className="font-semibold">{lead?.organisation_name ?? "Organisation unknown"}</p>
                <p className="line-clamp-2 text-muted">{draft.message}</p>
              </div>
              <p>{draft.status === "approved" ? "Approved, not sent" : "Waiting for review"}</p>
              <p className={flags.length ? "text-ochre" : "text-muted"}>
                {flags.length === 0 ? "Nothing flagged" : flags.length === 1 ? "1 thing to check" : `${flags.length} things to check`}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function DraftsPage() {
  return (
    <>
      <h1 className="text-4xl">Drafts to review</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading drafts</p>}>
        <DraftList />
      </Suspense>
    </>
  );
}

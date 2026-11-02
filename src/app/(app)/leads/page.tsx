import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ScoreTrack } from "@/components/score-track";
import { LEAD_STATUSES, type LeadStatus } from "@/contracts/lead-state";
import {
  filtersToQuery,
  LEADS_PER_PAGE,
  parseLeadFilters,
  type LeadFilters,
} from "@/lib/lead-filters";
import { formatDate, STATUS_LABELS } from "@/lib/lead-labels";
import { createSessionClient, getCurrentMember } from "@/server/session";

export const metadata: Metadata = { title: "Leads" };

type LeadRow = {
  id: string;
  organisation_name: string | null;
  project_title: string | null;
  original_content: string;
  source_type: string;
  country_code: string | null;
  status: LeadStatus;
  lead_score: number | null;
  discovered_at: string;
};

async function LeadList({ searchParams }: { searchParams: PageProps<"/leads">["searchParams"] }) {
  const member = await getCurrentMember();
  const filters = parseLeadFilters(await searchParams);
  const supabase = await createSessionClient();

  const from = (filters.page - 1) * LEADS_PER_PAGE;
  let query = supabase
    .from("leads")
    .select(
      "id, organisation_name, project_title, original_content, source_type, country_code, status, lead_score, discovered_at",
      { count: "exact" },
    )
    .eq("workspace_id", member.workspaceId)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("discovered_at", { ascending: false })
    .range(from, from + LEADS_PER_PAGE - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.minScore !== undefined) query = query.gte("lead_score", filters.minScore);
  if (filters.source) query = query.eq("source_type", filters.source);
  if (filters.service) query = query.contains("service_categories", [filters.service]);

  const [leadResult, serviceResult, sourceResult] = await Promise.all([
    query,
    supabase
      .from("services")
      .select("id, service_name")
      .eq("workspace_id", member.workspaceId)
      .eq("active", true)
      .order("service_name"),
    supabase
      .from("leads")
      .select("source_type")
      .eq("workspace_id", member.workspaceId)
      .limit(1000),
  ]);

  if (leadResult.error) {
    console.error(`Lead list failed: ${leadResult.error.message}`);
    return (
      <p role="alert" className="rounded-sm bg-alert-wash p-3 text-alert">
        The leads couldn&apos;t be loaded. Refresh the page to try again.
      </p>
    );
  }

  const leads = (leadResult.data ?? []) as LeadRow[];
  const total = leadResult.count ?? 0;
  const services = serviceResult.data ?? [];
  const sources = [...new Set((sourceResult.data ?? []).map((row) => row.source_type))].sort();
  const lastPage = Math.max(1, Math.ceil(total / LEADS_PER_PAGE));
  const filtered = Boolean(
    filters.status || filters.minScore !== undefined || filters.source || filters.service,
  );

  return (
    <>
      <FilterBar filters={filters} services={services} sources={sources} />
      <p className="mt-6 text-muted" aria-live="polite">
        {total === 1 ? "1 lead" : `${total} leads`}
      </p>
      {leads.length === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <ul className="mt-2 border-t border-line">
          {leads.map((lead) => (
            <li key={lead.id} className="border-b border-line">
              <Link
                href={`/leads/${lead.id}`}
                className="grid gap-x-6 gap-y-2 py-4 hover:bg-note-wash md:grid-cols-[10rem_minmax(0,1fr)_8rem_7rem] md:items-center md:px-2"
              >
                <ScoreTrack score={lead.lead_score} />
                <div className="min-w-0">
                  <p className="font-semibold">{lead.organisation_name ?? "Organisation unknown"}</p>
                  <p className="line-clamp-2 text-muted">
                    {lead.project_title ?? lead.original_content}
                  </p>
                </div>
                <p>{STATUS_LABELS[lead.status]}</p>
                <div className="text-sm text-muted">
                  <p>{lead.source_type}{lead.country_code ? `, ${lead.country_code}` : ""}</p>
                  <p>{formatDate(lead.discovered_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {lastPage > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex items-center gap-4">
          {filters.page > 1 ? (
            <Link className="button-quiet" href={`/leads${filtersToQuery(filters, filters.page - 1)}`}>
              Previous
            </Link>
          ) : null}
          <span>Page {filters.page} of {lastPage}</span>
          {filters.page < lastPage ? (
            <Link className="button-quiet" href={`/leads${filtersToQuery(filters, filters.page + 1)}`}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

function FilterBar({
  filters,
  services,
  sources,
}: {
  filters: LeadFilters;
  services: { id: string; service_name: string }[];
  sources: string[];
}) {
  return (
    <form
      method="get"
      action="/leads"
      className="mt-6 grid grid-cols-2 items-end gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]"
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Status
        <select name="status" defaultValue={filters.status ?? ""} className="field font-normal">
          <option value="">Any status</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Minimum score
        <input
          name="minScore"
          type="number"
          min={0}
          max={100}
          defaultValue={filters.minScore}
          className="field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Source
        <select name="source" defaultValue={filters.source ?? ""} className="field font-normal">
          <option value="">Any source</option>
          {sources.map((source) => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Service
        <select name="service" defaultValue={filters.service ?? ""} className="field font-normal">
          <option value="">Any service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>{service.service_name}</option>
          ))}
        </select>
      </label>
      <button className="button">Apply filters</button>
      <Link href="/leads" className="button-quiet text-center">Clear</Link>
    </form>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <p className="mt-6">
        No leads match these filters. <Link href="/leads" className="text-link">Clear the filters</Link> to see every lead.
      </p>
    );
  }
  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <p>No leads yet. Add your first one, or import a list from a CSV file.</p>
      <div className="flex gap-3">
        <Link href="/leads/new" className="button">Add a lead</Link>
        <Link href="/leads/import" className="button-quiet">Import a CSV</Link>
      </div>
    </div>
  );
}

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <>
      <h1 className="text-4xl">Leads</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading leads</p>}>
        <LeadList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

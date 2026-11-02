import { z } from "zod";
import { LEAD_STATUSES } from "@/contracts/lead-state";

export const LEADS_PER_PAGE = 25;

const empty = (value: unknown) => (value === "" ? undefined : value);

const filtersSchema = z.object({
  status: z.preprocess(empty, z.enum(LEAD_STATUSES).optional()).catch(undefined),
  minScore: z
    .preprocess(empty, z.coerce.number().int().min(0).max(100).optional())
    .catch(undefined),
  source: z
    .preprocess(empty, z.string().trim().max(50).optional())
    .catch(undefined),
  service: z.preprocess(empty, z.uuid().optional()).catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1).default(1),
});

export type LeadFilters = z.infer<typeof filtersSchema>;

// A bad value in the address is ignored, not shown as an error.
export function parseLeadFilters(
  params: Record<string, string | string[] | undefined>,
): LeadFilters {
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  return filtersSchema.parse(single);
}

export function filtersToQuery(filters: LeadFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.minScore !== undefined) query.set("minScore", String(filters.minScore));
  if (filters.source) query.set("source", filters.source);
  if (filters.service) query.set("service", filters.service);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

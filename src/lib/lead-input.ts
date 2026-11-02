import { createHash } from "node:crypto";
import Papa from "papaparse";
import { leadIngestSchema, type LeadIngest } from "@/contracts/ingest";

export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_IMPORT_ROWS = 500;

export type RawLeadFields = {
  content?: string;
  organisation?: string;
  url?: string;
  country?: string;
  contact_channel?: string;
  contact?: string;
  published_at?: string;
  source_id?: string;
};

const blankToNull = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

function normaliseDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
}

const FIELD_NAMES: Record<string, string> = {
  originalContent: "content",
  organisationName: "organisation",
  sourceUrl: "url",
  countryCode: "country",
  contactChannel: "contact_channel",
  contactValue: "contact",
  publishedAt: "published_at",
  sourceRecordId: "source_id",
};

const FIELD_HELP: Record<string, string> = {
  content: "Enter what the lead said or needs.",
  url: "Enter a full web address starting with https://.",
  country: "Use a two-letter country code, such as ZW or ZA.",
  published_at: "Use a date such as 2026-11-02.",
};

export type ParsedLead =
  | { ok: true; lead: LeadIngest }
  | { ok: false; errors: { field: string; message: string }[] };

export function parseLeadFields(
  raw: RawLeadFields,
  source: { type: string; keyPrefix: string },
): ParsedLead {
  const fields = {
    sourceRecordId: blankToNull(raw.source_id),
    sourceUrl: blankToNull(raw.url),
    organisationName: blankToNull(raw.organisation),
    countryCode: blankToNull(raw.country)?.toUpperCase() ?? null,
    contactChannel: blankToNull(raw.contact_channel),
    contactValue: blankToNull(raw.contact),
    originalContent: raw.content?.trim() ?? "",
    publishedAt: normaliseDate(blankToNull(raw.published_at)),
  };
  // The same details produce the same key, so a double submit or re-import creates nothing new.
  const fingerprint = createHash("sha256").update(JSON.stringify(fields)).digest("hex");
  const parsed = leadIngestSchema.safeParse({
    ...fields,
    idempotencyKey: `${source.keyPrefix}:${fingerprint}`,
    sourceType: source.type,
    sourceConfigId: null,
    authorHandle: null,
  });
  if (parsed.success) return { ok: true, lead: parsed.data };

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const field = FIELD_NAMES[String(issue.path[0])] ?? String(issue.path[0]);
      return { field, message: FIELD_HELP[field] ?? issue.message };
    }),
  };
}

export type CsvRow = { row: number; result: ParsedLead };

export type CsvParseResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; message: string };

export function parseLeadCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (!parsed.meta.fields?.includes("content")) {
    return { ok: false, message: "Add a column named content, then upload the file again." };
  }
  if (parsed.data.length === 0) {
    return { ok: false, message: "This file has a header but no leads." };
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      message: `This file has ${parsed.data.length} leads. Split it into files of ${MAX_IMPORT_ROWS} or fewer.`,
    };
  }

  return {
    ok: true,
    rows: parsed.data.map((row, index) => ({
      // Row 1 is the header, matching the row numbers in a spreadsheet.
      row: index + 2,
      result: parseLeadFields(row, { type: "csv", keyPrefix: "csv" }),
    })),
  };
}

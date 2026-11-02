import { z } from "zod";

// What n8n, the manual form and CSV import all send to ingestLead().
export const leadIngestSchema = z.strictObject({
  idempotencyKey: z.string().trim().min(8).max(200),
  sourceType: z.string().trim().min(1).max(50),
  sourceConfigId: z.uuid().nullable(),
  sourceRecordId: z.string().trim().min(1).max(500).nullable(),
  sourceUrl: z.url({ protocol: /^https?$/ }).nullable(),
  authorHandle: z.string().trim().min(1).max(200).nullable(),
  organisationName: z.string().trim().min(1).max(300).nullable(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/, "Use an ISO 3166-1 alpha-2 country code")
    .nullable(),
  contactChannel: z.string().trim().min(1).max(50).nullable(),
  contactValue: z.string().trim().min(1).max(320).nullable(),
  originalContent: z.string().trim().min(1).max(50_000),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type LeadIngest = z.infer<typeof leadIngestSchema>;

export const leadIngestResponseSchema = z.strictObject({
  outcome: z.enum(["created", "duplicate"]),
  // Null only when a replayed key refers to a lead that has since been erased.
  leadId: z.uuid().nullable(),
});
export type LeadIngestResponse = z.infer<typeof leadIngestResponseSchema>;

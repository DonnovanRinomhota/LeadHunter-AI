"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MAX_IMPORT_BYTES,
  parseLeadCsv,
  parseLeadFields,
  type RawLeadFields,
} from "@/lib/lead-input";
import { ingestLead, type IngestRpcClient } from "./ingest";
import { createSessionClient, getCurrentMember } from "./session";

export type LeadFormState = {
  message?: string;
  errors?: Record<string, string>;
  values?: RawLeadFields;
};

export async function createLead(
  _previous: LeadFormState,
  form: FormData,
): Promise<LeadFormState> {
  const member = await getCurrentMember();
  const text = (name: string) => String(form.get(name) ?? "");
  const values: RawLeadFields = {
    content: text("content"),
    organisation: text("organisation"),
    url: text("url"),
    country: text("country"),
    contact_channel: text("contact_channel"),
    contact: text("contact"),
    published_at: text("published_at"),
  };

  const parsed = parseLeadFields(values, { type: "manual", keyPrefix: "manual" });
  if (!parsed.ok) {
    return {
      values,
      errors: Object.fromEntries(parsed.errors.map((e) => [e.field, e.message])),
    };
  }

  const supabase = await createSessionClient();
  let result;
  try {
    result = await ingestLead(
      supabase as unknown as IngestRpcClient,
      member.workspaceId,
      parsed.lead,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Lead could not be saved");
    return { values, message: "The lead wasn't saved. Try again in a moment." };
  }

  if (!result.leadId) {
    return {
      values,
      message: "This lead was erased earlier, so it wasn't added again.",
    };
  }
  revalidatePath("/leads");
  redirect(
    `/leads/${result.leadId}${result.outcome === "duplicate" ? "?duplicate=1" : "?added=1"}`,
  );
}

export type ImportRowResult = {
  row: number;
  outcome: "created" | "duplicate" | "invalid" | "failed";
  leadId?: string | null;
  message?: string;
};

export type ImportState = {
  message?: string;
  results?: ImportRowResult[];
};

export async function importLeads(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  const member = await getCurrentMember();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose a CSV file to import." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { message: "This file is over 1 MB. Split it into smaller files." };
  }

  const parsed = parseLeadCsv(await file.text());
  if (!parsed.ok) return { message: parsed.message };

  const supabase = await createSessionClient();
  const results: ImportRowResult[] = [];
  for (const { row, result } of parsed.rows) {
    if (!result.ok) {
      results.push({
        row,
        outcome: "invalid",
        message: result.errors.map((e) => e.message).join(" "),
      });
      continue;
    }
    try {
      const saved = await ingestLead(
        supabase as unknown as IngestRpcClient,
        member.workspaceId,
        result.lead,
      );
      results.push({ row, outcome: saved.outcome, leadId: saved.leadId });
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Lead could not be saved");
      results.push({ row, outcome: "failed", message: "This row wasn't saved. Import it again." });
    }
  }
  revalidatePath("/leads");
  return { results };
}

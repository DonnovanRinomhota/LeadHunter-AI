"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSessionClient, getCurrentMember } from "../session";

export type DraftActionState = { message?: string; done?: string };

const uuid = z.uuid();

// Database errors are explained in plain words. The database itself enforces every rule.
function explain(message: string | undefined): string {
  if (message?.includes("opted out")) return "This contact has opted out, so the draft can't go ahead.";
  if (message?.includes("Only a pending")) return "This draft has already been decided. Refresh the page.";
  if (message?.includes("Only an approved")) return "Approve the draft before you mark it as sent.";
  if (message?.includes("cannot be edited")) return "This draft can no longer be edited.";
  if (message?.includes("needs a reason")) return "Enter a reason for rejecting this draft.";
  return "That didn't work. Refresh the page and try again.";
}

async function callDraftFunction(
  name: string,
  args: Record<string, unknown>,
  leadId: string,
  done: string,
): Promise<DraftActionState> {
  await getCurrentMember();
  const supabase = await createSessionClient();
  const { error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`${name} failed: ${error.message}`);
    return { message: explain(error.message) };
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/drafts");
  revalidatePath("/leads");
  return { done };
}

function ids(form: FormData) {
  const draft = uuid.safeParse(form.get("draftId"));
  const lead = uuid.safeParse(form.get("leadId"));
  return draft.success && lead.success ? { draftId: draft.data, leadId: lead.data } : null;
}

export async function saveDraftEdits(_state: DraftActionState, form: FormData) {
  const target = ids(form);
  const message = String(form.get("message") ?? "").trim();
  if (!target) return { message: "That didn't work. Refresh the page and try again." };
  if (message.length < 20) return { message: "Write a message of at least 20 characters." };
  if (message.length > 3000) return { message: "Shorten the message to 3,000 characters or fewer." };
  return callDraftFunction("edit_draft", { p_draft: target.draftId, p_message: message }, target.leadId, "Changes saved. Approve the draft when it's ready.");
}

export async function approveDraft(_state: DraftActionState, form: FormData) {
  const target = ids(form);
  if (!target) return { message: "That didn't work. Refresh the page and try again." };
  return callDraftFunction("approve_draft", { p_draft: target.draftId }, target.leadId, "Draft approved.");
}

export async function rejectDraft(_state: DraftActionState, form: FormData) {
  const target = ids(form);
  const reason = String(form.get("reason") ?? "").trim();
  if (!target) return { message: "That didn't work. Refresh the page and try again." };
  if (!reason) return { message: "Enter a reason for rejecting this draft." };
  return callDraftFunction("reject_draft", { p_draft: target.draftId, p_reason: reason.slice(0, 500) }, target.leadId, "Draft rejected.");
}

export async function markDraftSent(_state: DraftActionState, form: FormData) {
  const target = ids(form);
  if (!target) return { message: "That didn't work. Refresh the page and try again." };
  return callDraftFunction("mark_draft_sent", { p_draft: target.draftId }, target.leadId, "Marked as sent.");
}

export async function recordOptOut(_state: DraftActionState, form: FormData) {
  const member = await getCurrentMember();
  const lead = uuid.safeParse(form.get("leadId"));
  if (!lead.success) return { message: "That didn't work. Refresh the page and try again." };
  const supabase = await createSessionClient();
  const { error } = await supabase.from("contact_events").insert({
    workspace_id: member.workspaceId,
    lead_id: lead.data,
    event_type: "opt_out",
    notes: "Recorded from the lead page",
  });
  if (error) {
    console.error(`Opt-out failed: ${error.message}`);
    return { message: "The opt-out wasn't saved. Try again." };
  }
  revalidatePath(`/leads/${lead.data}`);
  revalidatePath("/drafts");
  return { done: "Opt-out recorded. This contact won't get new drafts." };
}

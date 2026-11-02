"use client";

import { useActionState, useState } from "react";
import type { DraftFlag } from "@/lib/draft-flags";
import {
  approveDraft,
  markDraftSent,
  recordOptOut,
  rejectDraft,
  saveDraftEdits,
  type DraftActionState,
} from "@/server/drafts/draft-actions";

const initial: DraftActionState = {};

function Feedback({ state }: { state: DraftActionState }) {
  if (state.message) {
    return <p role="alert" className="rounded-sm bg-alert-wash p-3 text-alert">{state.message}</p>;
  }
  if (state.done) {
    return <p role="status" className="rounded-sm bg-note-wash p-3">{state.done}</p>;
  }
  return null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button-quiet"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? "Message copied" : "Copy message"}
    </button>
  );
}

export type ReviewDraft = {
  id: string;
  leadId: string;
  status: string;
  channel: string;
  message: string;
  isSample: boolean;
  approverEmail: string | null;
  rejectionReason: string | null;
};

export function DraftReview({ draft, flags }: { draft: ReviewDraft; flags: DraftFlag[] }) {
  const [saveState, saveAction, saving] = useActionState(saveDraftEdits, initial);
  const [approveState, approveAction, approving] = useActionState(approveDraft, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectDraft, initial);
  const [sentState, sentAction, marking] = useActionState(markDraftSent, initial);

  const editable = draft.status === "pending" || draft.status === "approved";
  const hidden = (
    <>
      <input type="hidden" name="draftId" value={draft.id} />
      <input type="hidden" name="leadId" value={draft.leadId} />
    </>
  );

  return (
    <div className="mt-3 flex max-w-prose flex-col gap-4">
      {draft.isSample ? (
        <p role="status" className="rounded-sm bg-note-wash p-3">
          Sample draft for testing the review steps, not written by Claude.
        </p>
      ) : null}

      {flags.length > 0 ? (
        <section aria-label="Things to check" className="rounded-sm border-l-4 border-ochre bg-surface p-3">
          <h3 className="font-display text-lg font-semibold">Check {flags.length === 1 ? "this" : `these ${flags.length} things`} before approving</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {flags.map((flag) => (
              <li key={`${flag.kind}-${flag.detail}`}>
                <span className="font-semibold">{flag.kind}: </span>
                <span className="break-words">{flag.detail}</span>
                <span className="block text-sm text-muted">{flag.help}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Feedback state={saveState} />
      <Feedback state={approveState} />
      <Feedback state={rejectState} />
      <Feedback state={sentState} />

      {editable ? (
        <form action={saveAction} className="flex flex-col gap-2">
          {hidden}
          <label className="flex flex-col gap-1 font-semibold">
            Message ({draft.channel})
            <textarea
              key={draft.message}
              name="message"
              defaultValue={draft.message}
              className="field min-h-72 font-normal"
              maxLength={3000}
            />
          </label>
          {draft.status === "approved" ? (
            <p className="text-sm text-muted">Saving changes removes the approval, so the final text is always what was approved.</p>
          ) : null}
          <button className="button-quiet self-start" disabled={saving}>
            {saving ? "Saving changes" : "Save changes"}
          </button>
        </form>
      ) : (
        <blockquote className="whitespace-pre-wrap break-words border-l-4 border-line pl-4">{draft.message}</blockquote>
      )}

      {draft.status === "pending" ? (
        <>
          <form action={approveAction}>
            {hidden}
            <button className="button" disabled={approving}>{approving ? "Approving draft" : "Approve draft"}</button>
          </form>
          <form action={rejectAction} className="flex flex-col gap-2">
            {hidden}
            <label className="flex flex-col gap-1 font-semibold">
              Reason for rejecting
              <input name="reason" className="field font-normal" maxLength={500} />
            </label>
            <button className="button-quiet self-start" disabled={rejecting}>{rejecting ? "Rejecting draft" : "Reject draft"}</button>
          </form>
        </>
      ) : null}

      {draft.status === "approved" ? (
        <div className="flex flex-col gap-3">
          <p>
            Approved{draft.approverEmail ? ` by ${draft.approverEmail}` : ""}. LeadHunter doesn&apos;t send
            messages, so copy it and send it yourself, then mark it as sent. Only contact real prospects
            once the team has legal advice.
          </p>
          <div className="flex flex-wrap gap-3">
            <CopyButton text={draft.message} />
            <form action={sentAction}>
              {hidden}
              <button className="button" disabled={marking}>{marking ? "Marking as sent" : "Mark as sent"}</button>
            </form>
          </div>
        </div>
      ) : null}

      {draft.status === "rejected" ? <p>Rejected: {draft.rejectionReason ?? "No reason recorded"}</p> : null}
      {draft.status === "sent_manually" ? <p>Sent. The lead has moved to Contacted.</p> : null}
      {draft.status === "cancelled" ? <p>Cancelled because the contact opted out.</p> : null}
    </div>
  );
}

export function OptOutButton({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(recordOptOut, initial);
  return (
    <form action={action} className="mt-8 flex max-w-prose flex-col items-start gap-2 border-t border-line pt-4">
      <Feedback state={state} />
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-muted">Did this contact ask not to hear from us? Recording it cancels any active draft and blocks new ones.</p>
      <button className="button-quiet" disabled={pending}>{pending ? "Recording opt-out" : "Record opt-out"}</button>
    </form>
  );
}

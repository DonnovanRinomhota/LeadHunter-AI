"use client";

import { useActionState } from "react";
import { createLead, type LeadFormState } from "@/server/lead-actions";

const initial: LeadFormState = {};

function Field({
  label,
  name,
  hint,
  state,
  type = "text",
}: {
  label: string;
  name: "organisation" | "url" | "country" | "contact_channel" | "contact" | "published_at";
  hint?: string;
  state: LeadFormState;
  type?: string;
}) {
  const error = state.errors?.[name];
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <label className="flex flex-col gap-1 font-semibold">
      {label}
      {hint ? <span id={`${name}-hint`} className="text-sm font-normal text-muted">{hint}</span> : null}
      <input
        className="field font-normal"
        type={type}
        name={name}
        defaultValue={state.values?.[name]}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {error ? <span id={`${name}-error`} className="text-sm font-normal text-alert">{error}</span> : null}
    </label>
  );
}

export function LeadForm() {
  const [state, action, pending] = useActionState(createLead, initial);
  const contentError = state.errors?.content;
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      {state.message ? (
        <p role="alert" className="rounded-sm bg-alert-wash p-3 text-alert">{state.message}</p>
      ) : null}
      <label className="flex flex-col gap-1 font-semibold">
        What did they say or need?
        <textarea
          className="field min-h-36 font-normal"
          name="content"
          defaultValue={state.values?.content}
          aria-invalid={Boolean(contentError)}
          aria-describedby={contentError ? "content-error" : undefined}
          required
        />
        {contentError ? <span id="content-error" className="text-sm font-normal text-alert">{contentError}</span> : null}
      </label>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Organisation" name="organisation" state={state} />
        <Field label="Country code" name="country" hint="Two letters, such as ZW or ZA" state={state} />
        <Field label="Source web address" name="url" type="url" state={state} />
        <Field label="Date published" name="published_at" type="date" state={state} />
        <Field label="Contact method" name="contact_channel" hint="Such as email or phone" state={state} />
        <Field label="Contact details" name="contact" state={state} />
      </div>
      <button className="button self-start" disabled={pending}>
        {pending ? "Adding lead" : "Add lead"}
      </button>
    </form>
  );
}

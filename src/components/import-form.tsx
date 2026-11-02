"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importLeads, type ImportRowResult, type ImportState } from "@/server/lead-actions";

const initial: ImportState = {};

const OUTCOME_LABELS: Record<ImportRowResult["outcome"], string> = {
  created: "Added",
  duplicate: "Already in LeadHunter",
  invalid: "Not added",
  failed: "Not added",
};

export function ImportForm() {
  const [state, action, pending] = useActionState(importLeads, initial);
  const results = state.results ?? [];
  const added = results.filter((r) => r.outcome === "created").length;
  const duplicates = results.filter((r) => r.outcome === "duplicate").length;
  const problems = results.filter((r) => r.outcome === "invalid" || r.outcome === "failed");

  return (
    <>
      <form action={action} className="flex max-w-2xl flex-col items-start gap-4">
        {state.message ? (
          <p role="alert" className="w-full rounded-sm bg-alert-wash p-3 text-alert">{state.message}</p>
        ) : null}
        <label className="flex w-full flex-col gap-1 font-semibold">
          CSV file
          <input className="field font-normal" type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <button className="button" disabled={pending}>
          {pending ? "Importing leads" : "Import leads"}
        </button>
      </form>

      {results.length > 0 ? (
        <section className="mt-8 max-w-3xl" aria-live="polite">
          <h2 className="text-2xl">
            {added} added, {duplicates} already in LeadHunter, {problems.length} not added
          </h2>
          <table className="mt-4 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className="py-2 pr-4">Row</th>
                <th scope="col" className="py-2 pr-4">Result</th>
                <th scope="col" className="py-2">What to do</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.row} className="border-b border-line align-top">
                  <td className="py-2 pr-4 tabular-nums">{result.row}</td>
                  <td className="py-2 pr-4">{OUTCOME_LABELS[result.outcome]}</td>
                  <td className="py-2">
                    {result.message ? (
                      <span className="text-alert">{result.message}</span>
                    ) : result.leadId ? (
                      <Link className="text-link" href={`/leads/${result.leadId}`}>View lead</Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}

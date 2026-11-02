import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";

export const metadata: Metadata = { title: "Import a CSV" };

export default function ImportPage() {
  return (
    <>
      <h1 className="mb-2 text-4xl">Import a CSV</h1>
      <p className="mb-6 max-w-2xl text-muted">
        Upload up to 500 leads. Each row needs a <code>content</code> column.
        The other columns are optional, and importing the same file twice adds
        nothing new. Use made-up leads until the team has legal advice.
      </p>
      <p className="mb-6">
        <a className="text-link" href="/lead-import-template.csv" download>Download the template</a>
      </p>
      <ImportForm />
    </>
  );
}

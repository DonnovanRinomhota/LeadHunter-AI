import type { Metadata } from "next";
import { LeadForm } from "@/components/lead-form";

export const metadata: Metadata = { title: "Add a lead" };

export default function NewLeadPage() {
  return (
    <>
      <h1 className="mb-2 text-4xl">Add a lead</h1>
      <p className="mb-6 max-w-2xl text-muted">
        Only add details you know to be true, and leave the rest blank. Use
        made-up leads until the team has legal advice.
      </p>
      <LeadForm />
    </>
  );
}

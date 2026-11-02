import type { LeadStatus } from "@/contracts/lead-state";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  qualifying: "Being scored",
  qualified: "Qualified",
  research: "Research",
  disqualified: "Disqualified",
  draft_ready: "Draft ready",
  approved: "Approved",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

export function priorityLabel(score: number | null): string {
  if (score === null) return "Not scored";
  if (score >= 80) return "High priority";
  if (score >= 60) return "Medium priority";
  return "Low priority";
}

export function safeWebUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: string | null): string {
  return value ? dateFormat.format(new Date(value)) : "Unknown";
}

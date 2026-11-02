// Mirrors the checks in supabase/migrations. The database is what enforces these.
export const LEAD_STATUSES = [
  "new",
  "qualifying",
  "qualified",
  "disqualified",
  "draft_ready",
  "approved",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "won",
  "lost",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const RECOMMENDED_ACTIONS = [
  "review",
  "research",
  "reject",
  "needs_information",
  "compliance_review",
] as const;
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

// Only "review" allows an outreach draft.
export const DRAFT_ALLOWED_ACTION: RecommendedAction = "review";

export const QUALIFIED_MINIMUM_SCORE = 60;

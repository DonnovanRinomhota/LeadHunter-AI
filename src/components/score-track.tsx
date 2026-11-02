import { QUALIFIED_MINIMUM_SCORE } from "@/contracts/lead-state";
import { priorityLabel } from "@/lib/lead-labels";

const HIGH_PRIORITY_SCORE = 80;

// A track with its two real thresholds marked, so a score reads against the rules that use it.
export function ScoreTrack({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted">Not scored</span>;
  }
  return (
    <div className="w-full max-w-40">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tabular-nums">{score}</span>
        <span className="text-sm text-muted">{priorityLabel(score)}</span>
      </div>
      <div aria-hidden="true" className="relative mt-1 h-1.5 bg-line">
        <div className="h-full bg-msasa" style={{ width: `${score}%` }} />
        <div
          className="absolute -top-0.5 h-2.5 w-px bg-ink"
          style={{ left: `${QUALIFIED_MINIMUM_SCORE}%` }}
        />
        <div
          className="absolute -top-0.5 h-2.5 w-px bg-ink"
          style={{ left: `${HIGH_PRIORITY_SCORE}%` }}
        />
      </div>
    </div>
  );
}

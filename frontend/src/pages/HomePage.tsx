import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HomeStats,
  MasteryCounts,
  MasteryLevel,
  ReviewCard,
  SubjectMastery,
  api,
} from "../api";
import { PracticeIcon } from "../components/Icons";

const MASTERY_COLOR: Record<MasteryLevel, string> = {
  memorized: "bg-emerald-500",
  familiar: "bg-blue-500",
  learning: "bg-amber-500",
  new: "bg-zinc-600",
};

const MASTERY_LABEL: Record<MasteryLevel, string> = {
  memorized: "Memorized",
  familiar: "Familiar",
  learning: "Learning",
  new: "New",
};

export default function HomePage() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .homeStats()
      .then(setStats)
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-xl font-semibold">Home</h1>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-xl font-semibold">Home</h1>
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  const { totals, subjects, needs_review } = stats;
  const empty = totals.cards === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Home</h1>
        <Link
          to="/practice?auto=1"
          className={
            "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium " +
            (empty
              ? "pointer-events-none bg-blue-600/40 text-white/60"
              : "bg-blue-600 text-white hover:bg-blue-500")
          }
          aria-disabled={empty}
        >
          <PracticeIcon />
          Practice all
        </Link>
      </header>

      <section
        className={
          "grid grid-cols-2 gap-3 " +
          (totals.drafts > 0 ? "md:grid-cols-5" : "md:grid-cols-4")
        }
      >
        <Tile label="Subjects" value={totals.subjects} />
        <Tile label="Cards" value={totals.cards} />
        <Tile
          label="Memorized"
          value={totals.memorized}
          hint={totals.cards ? `${pct(totals.memorized, totals.cards)}%` : undefined}
          accent="text-emerald-400"
        />
        <Tile
          label="New"
          value={totals.new}
          hint={totals.cards ? `${pct(totals.new, totals.cards)}%` : undefined}
          accent="text-zinc-300"
        />
        {/* Only worth a tile when there is something to finish. */}
        {totals.drafts > 0 && (
          <Tile
            label="Drafts"
            value={totals.drafts}
            hint="Finish →"
            accent="text-amber-300"
            to="/cards?draft=drafts"
            title={`${totals.drafts} draft card${
              totals.drafts === 1 ? "" : "s"
            } — not counted above and never served in practice. Click to edit them.`}
          />
        )}
      </section>

      <Legend />

      <section className="space-y-2">
        <h2 className="text-base font-medium text-zinc-100">Subjects</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No subjects yet.{" "}
            <Link to="/subjects" className="text-blue-300 hover:underline">
              Create one
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
            {subjects.map((s) => (
              <SubjectRow key={s.id} subject={s} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-zinc-100">Needs review</h2>
        {needs_review.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {empty
              ? "Add a card and start practicing — review suggestions will appear here."
              : "Nothing is due — keep up the good work."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
            {needs_review.map((c) => (
              <ReviewRow key={c.id} card={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface TileProps {
  label: string;
  value: number;
  hint?: string;
  accent?: string;
  /** When set, the tile becomes a link to this route. */
  to?: string;
  title?: string;
}

function Tile({ label, value, hint, accent = "text-zinc-100", to, title }: TileProps) {
  const body = (
    <>
      <div className={`text-3xl font-semibold tabular-nums ${accent}`}>{value}</div>
      <div className="mt-1 flex items-baseline justify-between text-xs text-zinc-400">
        <span>{label}</span>
        {hint && <span className="text-zinc-500">{hint}</span>}
      </div>
    </>
  );
  const shell = "rounded border border-zinc-800 bg-zinc-900 p-4";
  if (!to) {
    return (
      <div className={shell} title={title}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={to}
      title={title}
      className={`${shell} block border-amber-900/70 hover:border-amber-700 hover:bg-zinc-800`}
    >
      {body}
    </Link>
  );
}

function Legend() {
  const order: MasteryLevel[] = ["memorized", "familiar", "learning", "new"];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
      {order.map((lvl) => (
        <span key={lvl} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${MASTERY_COLOR[lvl]}`} />
          {MASTERY_LABEL[lvl]}
        </span>
      ))}
    </div>
  );
}

function SubjectRow({ subject }: { subject: SubjectMastery }) {
  const empty = subject.card_count === 0;
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
      <Link
        to={`/subjects/${subject.id}`}
        className="min-w-0 flex-1 truncate text-blue-300 hover:text-blue-200 hover:underline"
      >
        {subject.name}
      </Link>
      <div className="flex w-full max-w-md items-center gap-2 sm:w-auto sm:flex-1">
        <StackedBar counts={subject} />
        <span className="w-20 text-right text-xs tabular-nums text-zinc-500">
          {subject.card_count} card{subject.card_count === 1 ? "" : "s"}
        </span>
      </div>
      <Link
        to={`/practice?subject=${subject.id}&auto=1`}
        className={
          "inline-flex items-center gap-1 rounded border border-blue-700/60 px-2 py-1 text-xs text-blue-200 " +
          (empty ? "opacity-50" : "hover:bg-blue-900/30")
        }
        onClick={(e) => {
          if (empty) e.preventDefault();
        }}
        aria-disabled={empty}
        title={empty ? "No cards in this subject" : `Practice ${subject.name}`}
      >
        <PracticeIcon width={12} height={12} />
        Practice
      </Link>
    </li>
  );
}

function StackedBar({ counts }: { counts: MasteryCounts }) {
  const total = counts.memorized + counts.familiar + counts.learning + counts.new;
  if (total === 0) {
    return <div className="h-2 flex-1 rounded bg-zinc-800" />;
  }
  const segments: Array<{ level: MasteryLevel; n: number }> = [
    { level: "memorized", n: counts.memorized },
    { level: "familiar", n: counts.familiar },
    { level: "learning", n: counts.learning },
    { level: "new", n: counts.new },
  ];
  return (
    <div className="flex h-2 flex-1 overflow-hidden rounded bg-zinc-800">
      {segments.map(({ level, n }) =>
        n > 0 ? (
          <div
            key={level}
            className={MASTERY_COLOR[level]}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${MASTERY_LABEL[level]}: ${n}`}
          />
        ) : null,
      )}
    </div>
  );
}

function ReviewRow({ card }: { card: ReviewCard }) {
  const preview = previewText(card.front_md);
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${MASTERY_COLOR[card.mastery]}`}
        title={MASTERY_LABEL[card.mastery]}
      />
      <Link
        to={`/cards/${card.id}`}
        className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-white"
        title={preview}
      >
        {preview || <span className="text-zinc-500">(empty)</span>}
      </Link>
      <span className="hidden text-xs text-zinc-500 sm:inline">
        {card.subject_name}
      </span>
      <Link
        to={`/practice?subject=${card.subject_id}&auto=1`}
        className="inline-flex items-center gap-1 rounded border border-blue-700/60 px-2 py-1 text-xs text-blue-200 hover:bg-blue-900/30"
        title={`Practice ${card.subject_name}`}
      >
        <PracticeIcon width={12} height={12} />
        Practice
      </Link>
    </li>
  );
}

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function previewText(md: string): string {
  const stripped = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[#>*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 120 ? stripped.slice(0, 117) + "…" : stripped;
}

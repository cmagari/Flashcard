import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, CardSummary, Subject } from "../api";
import { useConfirm } from "../components/Dialog";
import CardPreview from "../components/CardPreview";
import { DraftBadge } from "../components/DraftToggle";

export default function SubjectDetailPage() {
  const { id } = useParams();
  const subjectId = id ? Number(id) : null;
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refreshSubjects() {
    const ss = await api.listSubjects();
    setAllSubjects(ss);
    if (subjectId != null) {
      const found = ss.find((s) => s.id === subjectId) ?? null;
      setSubject(found);
    }
  }

  async function refreshCards() {
    if (subjectId == null) return;
    try {
      const rows = await api.listCards({
        subject_id: subjectId,
        q: q || undefined,
      });
      setCards(rows);
      setSelected((prev) => {
        const valid = new Set(rows.map((c) => c.id));
        const next = new Set<number>();
        prev.forEach((id) => {
          if (valid.has(id)) next.add(id);
        });
        return next;
      });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refreshSubjects().catch((err) => setError((err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  useEffect(() => {
    const t = setTimeout(refreshCards, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, q]);

  const allChecked = cards.length > 0 && selected.size === cards.length;
  const someChecked = selected.size > 0 && !allChecked;
  const otherSubjects = useMemo(
    () => allSubjects.filter((s) => s.id !== subjectId),
    [allSubjects, subjectId],
  );

  function toggleAll() {
    if (allChecked || someChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cards.map((c) => c.id)));
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const n = selected.size;
    if (n === 0) return;
    const ok = await confirm({
      title: `Delete ${n} card${n === 1 ? "" : "s"}?`,
      message: "These cards will be permanently deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      for (const id of selected) {
        await api.deleteCard(id);
      }
      setSelected(new Set());
      refreshCards();
      refreshSubjects();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function bulkDuplicate() {
    const n = selected.size;
    if (n === 0) return;
    setBusy(true);
    try {
      // Duplicate in the cards' original order so copies keep a stable order.
      const toCopy = cards.filter((c) => selected.has(c.id));
      for (const c of toCopy) {
        await api.createCard({
          subject_id: c.subject_id,
          front_md: c.front_md,
          back_md: c.back_md,
          tag_names: c.tags,
          is_draft: c.is_draft,
        });
      }
      setSelected(new Set());
      refreshCards();
      refreshSubjects();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function bulkMove(targetSubjectId: number) {
    setBusy(true);
    try {
      for (const id of selected) {
        await api.updateCard(id, { subject_id: targetSubjectId });
      }
      setSelected(new Set());
      setMoveOpen(false);
      refreshCards();
      refreshSubjects();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (subjectId == null) {
    return <div className="p-6 text-sm text-zinc-400">Invalid subject.</div>;
  }
  if (subject == null && allSubjects.length > 0) {
    return (
      <div className="p-6 text-sm text-zinc-400">
        Subject not found.{" "}
        <Link to="/subjects" className="text-blue-400 underline">
          Back to subjects
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Link
          to="/subjects"
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          ← Subjects
        </Link>
        <h1 className="text-xl font-semibold">{subject?.name ?? "…"}</h1>
        <span className="text-sm text-zinc-500">
          {cards.length} card{cards.length === 1 ? "" : "s"}
        </span>
        <div className="flex-1" />
        <Link
          to={`/cards/new?subject_id=${subjectId}`}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500"
        >
          New card
        </Link>
      </div>
      {subject?.description && (
        <p className="text-sm text-zinc-400">{subject.description}</p>
      )}
      {subject && !subject.include_in_general_practice && (
        <p className="text-xs text-amber-300">
          Opt-in practice: this subject is excluded from general practice unless
          you select it explicitly.
        </p>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search within this subject…"
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded border border-blue-800 bg-blue-950/80 px-3 py-2 backdrop-blur">
          <span className="text-sm">
            {selected.size} selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-zinc-300 hover:text-white"
          >
            Clear
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setMoveOpen(true)}
            disabled={busy || otherSubjects.length === 0}
            className="rounded border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
            title={otherSubjects.length === 0 ? "No other subjects to move to" : undefined}
          >
            Move…
          </button>
          <button
            onClick={bulkDuplicate}
            disabled={busy}
            className="rounded border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Duplicate
          </button>
          <button
            onClick={bulkDelete}
            disabled={busy}
            className="rounded border border-red-900 px-3 py-1 text-sm text-red-300 hover:bg-red-900/40 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}

      <div className="rounded border border-zinc-800">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked;
            }}
            onChange={toggleAll}
            disabled={cards.length === 0}
            aria-label="Select all"
            className="accent-blue-500"
          />
          <span>{allChecked ? "All selected" : someChecked ? "Some selected" : "Select all"}</span>
        </div>

        <ul className="divide-y divide-zinc-800">
          {cards.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-zinc-500">
              No cards yet.{" "}
              <Link
                to={`/cards/new?subject_id=${subjectId}`}
                className="text-blue-400 underline"
              >
                Create one
              </Link>
              .
            </li>
          )}
          {cards.map((c) => {
            const checked = selected.has(c.id);
            return (
              <li
                key={c.id}
                className={`flex items-start gap-3 px-3 py-2 ${
                  checked ? "bg-blue-950/30" : "hover:bg-zinc-900"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOne(c.id)}
                  aria-label={`Select card ${c.id}`}
                  className="mt-1 accent-blue-500"
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/cards/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/cards/${c.id}`);
                    }
                  }}
                  className="flex flex-1 cursor-pointer flex-col gap-1.5 text-left focus:outline-none"
                >
                  {(c.is_draft || c.tags.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      {c.is_draft && <DraftBadge />}
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-blue-900/40 px-2 py-0.5 text-blue-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <CardPreview source={c.front_md} label="Front" emptyText="(empty front)" />
                    <CardPreview source={c.back_md} label="Back" emptyText="(empty back)" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {moveOpen && (
        <MoveDialog
          count={selected.size}
          targets={otherSubjects}
          onCancel={() => setMoveOpen(false)}
          onMove={bulkMove}
          busy={busy}
        />
      )}
    </div>
  );
}

interface MoveProps {
  count: number;
  targets: Subject[];
  onCancel: () => void;
  onMove: (targetId: number) => void;
  busy: boolean;
}

function MoveDialog({ count, targets, onCancel, onMove, busy }: MoveProps) {
  const [target, setTarget] = useState<number | "">(targets[0]?.id ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 id="move-title" className="mb-2 text-base font-semibold text-zinc-100">
          Move {count} card{count === 1 ? "" : "s"}
        </h2>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Move to subject</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            autoFocus
          >
            {targets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => target !== "" && onMove(target)}
            disabled={busy || target === ""}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}

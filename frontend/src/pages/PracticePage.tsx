import { useCallback, useEffect, useState } from "react";
import { api, Card, Subject, Tag } from "../api";
import MarkdownView from "../components/MarkdownView";

type Mode = "random" | "inorder" | "smart";

export default function PracticePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [subjectId, setSubjectId] = useState<number | "">("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("smart");

  const [started, setStarted] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [showBack, setShowBack] = useState(false);
  const [counts, setCounts] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listSubjects().then(setSubjects).catch(() => {});
    api.listTags().then(setTags).catch(() => {});
  }, []);

  const fetchNext = useCallback(
    async (cursorId?: number) => {
      setBusy(true);
      try {
        const next = await api.nextCard({
          mode,
          subject_id: subjectId === "" ? undefined : subjectId,
          tag_ids: tagIds.length ? tagIds : undefined,
          cursor_id: cursorId,
        });
        if (!next) {
          setCard(null);
          setDone(true);
        } else {
          setCard(next);
          setShowBack(false);
          setDone(false);
        }
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [mode, subjectId, tagIds],
  );

  function start() {
    setStarted(true);
    setCounts({ correct: 0, incorrect: 0, skipped: 0 });
    setDone(false);
    fetchNext();
  }

  function quit() {
    setStarted(false);
    setCard(null);
    setShowBack(false);
    setDone(false);
  }

  async function record(result: "correct" | "incorrect") {
    if (!card) return;
    try {
      await api.recordAttempt(card.id, result);
      setCounts((c) => ({ ...c, [result]: c[result] + 1 }));
      if (mode === "inorder") {
        fetchNext(card.id);
      } else {
        fetchNext();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function skip() {
    if (!card) return;
    setCounts((c) => ({ ...c, skipped: c.skipped + 1 }));
    if (mode === "inorder") {
      fetchNext(card.id);
    } else {
      fetchNext();
    }
  }

  useEffect(() => {
    if (!started || !card) return;
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setShowBack((v) => !v);
      } else if (e.key === "1") {
        record("correct");
      } else if (e.key === "2") {
        record("incorrect");
      } else if (e.key === "3") {
        skip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, card?.id, mode, subjectId, tagIds]);

  function toggleTag(id: number) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-semibold">Practice</h1>

        <div className="space-y-3 rounded border border-zinc-800 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Subject</span>
              <select
                value={subjectId}
                onChange={(e) =>
                  setSubjectId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              >
                <option value="">All</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              >
                <option value="smart">Smart</option>
                <option value="random">Random</option>
                <option value="inorder">In order</option>
              </select>
            </label>
          </div>

          {tags.length > 0 && (
            <div>
              <p className="text-sm text-zinc-400">Tags (optional, AND filter)</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {tags.map((t) => {
                  const active = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTag(t.id)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        active
                          ? "border-blue-500 bg-blue-700/40 text-white"
                          : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={start}
            className="rounded bg-blue-600 px-4 py-1.5 font-medium hover:bg-blue-500"
          >
            Start
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-2 text-sm">
        <span className="text-zinc-400">{mode}</span>
        <span className="text-zinc-500">·</span>
        <span className="text-green-400">✓ {counts.correct}</span>
        <span className="text-red-400">✗ {counts.incorrect}</span>
        <span className="text-zinc-400">⤼ {counts.skipped}</span>
        <div className="flex-1" />
        <button
          onClick={quit}
          className="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
        >
          End session
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        {done || !card ? (
          <div className="space-y-3 text-center">
            <p className="text-lg">No more cards in this scope.</p>
            <button
              onClick={quit}
              className="rounded bg-blue-600 px-4 py-1.5 hover:bg-blue-500"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-3xl flex-col gap-4">
            <div className="text-xs text-zinc-500">
              {card.subject_name}
              {card.tags.length > 0 && " · " + card.tags.join(", ")}
            </div>
            <div
              onClick={() => setShowBack((v) => !v)}
              className="min-h-[12rem] cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-lg shadow-md hover:border-zinc-600"
              title="Click or press space to flip"
            >
              <MarkdownView source={showBack ? card.back_md : card.front_md} />
              <p className="mt-3 text-xs text-zinc-500">
                {showBack ? "Back" : "Front"} — click or press space to flip
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => record("correct")}
                disabled={busy}
                className="flex-1 rounded bg-green-700 px-4 py-2 font-medium hover:bg-green-600 disabled:opacity-50"
              >
                Correct (1)
              </button>
              <button
                onClick={() => record("incorrect")}
                disabled={busy}
                className="flex-1 rounded bg-red-700 px-4 py-2 font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Incorrect (2)
              </button>
              <button
                onClick={skip}
                disabled={busy}
                className="flex-1 rounded border border-zinc-700 px-4 py-2 hover:bg-zinc-800 disabled:opacity-50"
              >
                Skip (3)
              </button>
            </div>
            <div className="text-center text-xs text-zinc-500">
              Last 10: {card.last10_attempts.filter((a) => a.result === "correct").length} correct ·{" "}
              {card.last10_attempts.filter((a) => a.result === "incorrect").length} incorrect
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, Card, Subject, Tag } from "../api";
import CardEditModal from "../components/CardEditModal";
import MarkdownView from "../components/MarkdownView";

type Mode = "random" | "inorder" | "smart";

// In smart mode, a card is considered "mastered for this session" once the
// user has answered it correctly this many times, and is excluded from
// subsequent picks. Wrong answers don't count — unlimited retries are fine.
const SESSION_MASTERY_THRESHOLD = 2;

export default function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const initialSubjectIds = (() => {
    // Multi-select uses ?subjects=1,2,3; the legacy ?subject=1 link (from the
    // home page) is still honored as a single selection.
    const multi = searchParams.get("subjects");
    const raw = multi ?? searchParams.get("subject");
    if (!raw) return [] as number[];
    return raw
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
  })();
  const [subjectIds, setSubjectIds] = useState<number[]>(initialSubjectIds);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("smart");

  const [started, setStarted] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [showBack, setShowBack] = useState(false);
  const [counts, setCounts] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  // sessionCorrects is mirrored in a ref so fetchNext can read the latest
  // value synchronously after record() updates state — useState alone would
  // leave fetchNext's closure one render behind.
  const sessionCorrectsRef = useRef<Record<number, number>>({});
  const [masteredCount, setMasteredCount] = useState(0);

  useEffect(() => {
    api.listSubjects().then(setSubjects).catch(() => {});
    api.listTags().then(setTags).catch(() => {});
  }, []);

  const fetchNext = useCallback(
    async (cursorId?: number) => {
      setBusy(true);
      try {
        const excludeIds =
          mode === "smart"
            ? Object.entries(sessionCorrectsRef.current)
                .filter(([, n]) => n >= SESSION_MASTERY_THRESHOLD)
                .map(([id]) => Number(id))
            : undefined;
        const next = await api.nextCard({
          mode,
          subject_ids: subjectIds.length ? subjectIds : undefined,
          tag_ids: tagIds.length ? tagIds : undefined,
          cursor_id: cursorId,
          exclude_ids: excludeIds,
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
    [mode, subjectIds, tagIds],
  );

  function resetSession() {
    sessionCorrectsRef.current = {};
    setMasteredCount(0);
    setCounts({ correct: 0, incorrect: 0, skipped: 0 });
    setDone(false);
  }

  function start() {
    resetSession();
    setStarted(true);
    fetchNext();
  }

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (searchParams.get("auto") !== "1") return;
    autoStartedRef.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("auto");
        return next;
      },
      { replace: true },
    );
    resetSession();
    setStarted(true);
    fetchNext();
  }, [searchParams, setSearchParams, fetchNext]);

  function quit() {
    resetSession();
    setStarted(false);
    setCard(null);
    setShowBack(false);
  }

  async function record(result: "correct" | "incorrect") {
    if (!card) return;
    try {
      await api.recordAttempt(card.id, result);
      setCounts((c) => ({ ...c, [result]: c[result] + 1 }));
      if (result === "correct") {
        const cur = sessionCorrectsRef.current;
        const prevCount = cur[card.id] ?? 0;
        const nextCount = prevCount + 1;
        cur[card.id] = nextCount;
        if (nextCount === SESSION_MASTERY_THRESHOLD) {
          setMasteredCount((n) => n + 1);
        }
      }
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
    if (!started || !card || editing) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      // Don't flip/grade the card behind an open dialog (e.g. the help modal).
      if (target?.closest?.('[role="dialog"]')) return;
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
  }, [started, card?.id, mode, subjectIds, tagIds, editing]);

  function toggleTag(id: number) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSubject(id: number) {
    setSubjectIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      setSearchParams(
        (sp) => {
          const params = new URLSearchParams(sp);
          params.delete("subject");
          if (next.length) params.set("subjects", next.join(","));
          else params.delete("subjects");
          return params;
        },
        { replace: true },
      );
      return next;
    });
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-semibold">Practice</h1>

        <div className="space-y-3 rounded border border-zinc-800 p-4">
          <div className="flex flex-wrap items-center gap-3">
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

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                Subjects{" "}
                {subjectIds.length === 0
                  ? "(all)"
                  : `(${subjectIds.length} selected)`}
              </p>
              {subjectIds.length > 0 && (
                <button
                  onClick={() => {
                    setSubjectIds([]);
                    setSearchParams(
                      (sp) => {
                        const params = new URLSearchParams(sp);
                        params.delete("subject");
                        params.delete("subjects");
                        return params;
                      },
                      { replace: true },
                    );
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {subjects.map((s) => {
                const active = subjectIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSubject(s.id)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      active
                        ? "border-blue-500 bg-blue-700/40 text-white"
                        : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
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
        {mode === "smart" && (
          <>
            <span className="text-zinc-500">·</span>
            <span
              className="text-emerald-400"
              title={`Cards with ${SESSION_MASTERY_THRESHOLD}+ correct answers this session — excluded from further smart picks`}
            >
              ★ {masteredCount} mastered
            </span>
          </>
        )}
        <div className="flex-1" />
        {card && (
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
          >
            Edit card
          </button>
        )}
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
      {editing && card && (
        <CardEditModal
          card={card}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setCard(updated);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

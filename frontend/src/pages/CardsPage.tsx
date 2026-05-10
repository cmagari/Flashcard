import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, CardSummary, Subject, Tag } from "../api";
import CardPreview from "../components/CardPreview";

export default function CardsPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [q, setQ] = useState("");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSubjects().then(setSubjects).catch(() => {});
    api.listTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .listCards({
          q: q || undefined,
          subject_id: subjectId === "" ? undefined : subjectId,
          tag_ids: tagIds.length ? tagIds : undefined,
        })
        .then((rows) => {
          setCards(rows);
          setError(null);
        })
        .catch((err) => setError((err as Error).message));
    }, 150);
    return () => clearTimeout(t);
  }, [q, subjectId, tagIds]);

  function toggleTag(id: number) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const noSubjects = subjects.length === 0;

  const tagOptions = useMemo(() => tags.slice().sort((a, b) => a.name.localeCompare(b.name)), [tags]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cards</h1>
        <Link
          to="/cards/new"
          className={`rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 ${
            noSubjects ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={noSubjects}
          title={noSubjects ? "Create a subject first" : "New card"}
        >
          New card
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search front/back/subject/tag…"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm md:col-span-2"
        />
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value === "" ? "" : Number(e.target.value))}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {tagOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tagOptions.map((t) => {
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
                {t.name} <span className="text-zinc-500">({t.usage_count})</span>
              </button>
            );
          })}
          {tagIds.length > 0 && (
            <button
              onClick={() => setTagIds([])}
              className="rounded-full px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
        {cards.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500">No cards match.</li>
        )}
        {cards.map((c) => (
          <li
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/cards/${c.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/cards/${c.id}`);
              }
            }}
            className="cursor-pointer px-3 py-2 hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                {c.subject_name}
              </span>
              {c.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-blue-900/40 px-2 py-0.5 text-blue-200"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CardPreview source={c.front_md} label="Front" emptyText="(empty front)" />
              <CardPreview source={c.back_md} label="Back" emptyText="(empty back)" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

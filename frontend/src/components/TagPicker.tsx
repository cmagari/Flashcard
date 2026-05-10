import { useEffect, useState } from "react";
import { api, Tag } from "../api";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function TagPicker({ selected, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api.listTags().then(setAllTags).catch(() => {});
  }, []);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...selected, trimmed]);
    setDraft("");
  }

  function remove(name: string) {
    onChange(selected.filter((s) => s !== name));
  }

  const suggestions = allTags
    .filter(
      (t) =>
        !selected.some((s) => s.toLowerCase() === t.name.toLowerCase()) &&
        (draft === "" || t.name.toLowerCase().includes(draft.toLowerCase())),
    )
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full bg-blue-700/40 px-2 py-0.5 text-sm"
          >
            {s}
            <button
              type="button"
              onClick={() => remove(s)}
              className="text-blue-200 hover:text-white"
              aria-label={`Remove tag ${s}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && selected.length) {
              onChange(selected.slice(0, -1));
            }
          }}
          placeholder="Add tag…"
          className="min-w-[8rem] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => add(s.name)}
              className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

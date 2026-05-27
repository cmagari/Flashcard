import { useEffect, useState } from "react";
import { api, Card, Subject } from "../api";
import CardEditor from "./CardEditor";
import MarkdownView from "./MarkdownView";
import TagPicker from "./TagPicker";

interface Props {
  card: Card;
  onClose: () => void;
  onSaved: (updated: Card) => void;
}

export default function CardEditModal({ card, onClose, onSaved }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number>(card.subject_id);
  const [front, setFront] = useState(card.front_md);
  const [back, setBack] = useState(card.back_md);
  const [tagNames, setTagNames] = useState<string[]>(card.tags);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listSubjects().then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateCard(card.id, {
        subject_id: subjectId,
        front_md: front,
        back_md: back,
        tag_names: tagNames,
      });
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Edit card</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Subject</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex-1 min-w-[16rem]">
            <TagPicker selected={tagNames} onChange={setTagNames} />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-3">
            <CardEditor label="Front" value={front} onChange={setFront} />
            <CardEditor label="Back" value={back} onChange={setBack} />
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-auto">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-400">Front preview</span>
              <div className="min-h-[8rem] rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <MarkdownView source={front} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-400">Back preview</span>
              <div className="min-h-[8rem] rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                <MarkdownView source={back} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

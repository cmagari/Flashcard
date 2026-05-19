import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, Subject } from "../api";
import { useConfirm } from "../components/Dialog";
import { PracticeIcon } from "../components/Icons";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function refresh() {
    try {
      setSubjects(await api.listSubjects());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    const name = draft.trim();
    if (!name) {
      setError("Type a subject name first.");
      return;
    }
    try {
      await api.createSubject(name);
      setDraft("");
      setError(null);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(s: Subject) {
    const ok = await confirm({
      title: "Delete subject?",
      message: `"${s.name}" and its ${s.card_count} card${s.card_count === 1 ? "" : "s"} will be permanently deleted.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteSubject(s.id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Subjects</h1>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New subject name"
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <button
          onClick={add}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500"
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
        {subjects.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500">No subjects yet.</li>
        )}
        {subjects.map((s) => (
          <SubjectRow
            key={s.id}
            subject={s}
            onRenamed={refresh}
            onDeleted={() => remove(s)}
            onError={setError}
          />
        ))}
      </ul>
    </div>
  );
}

interface RowProps {
  subject: Subject;
  onRenamed: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}

function SubjectRow({ subject, onRenamed, onDeleted, onError }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subject.name);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(subject.name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(subject.name);
  }

  async function save() {
    const name = draft.trim();
    if (!name) {
      onError("Subject name can't be empty.");
      return;
    }
    if (name === subject.name) {
      setEditing(false);
      return;
    }
    try {
      await api.renameSubject(subject.id, name);
      setEditing(false);
      onRenamed();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancelEdit();
            }}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
          />
          <button
            onClick={save}
            className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-500"
          >
            Save
          </button>
          <button
            onClick={cancelEdit}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <Link
            to={`/subjects/${subject.id}`}
            className="flex-1 truncate text-blue-300 hover:text-blue-200 hover:underline"
          >
            {subject.name}
          </Link>
          <span className="text-xs text-zinc-500">
            {subject.card_count} card{subject.card_count === 1 ? "" : "s"}
          </span>
          <Link
            to={`/practice?subject=${subject.id}&auto=1`}
            className="inline-flex items-center gap-1 rounded border border-blue-700/60 px-2 py-1 text-xs text-blue-200 hover:bg-blue-900/30"
            title={
              subject.card_count === 0
                ? "No cards in this subject"
                : `Practice ${subject.name}`
            }
            onClick={(e) => {
              if (subject.card_count === 0) e.preventDefault();
            }}
            aria-disabled={subject.card_count === 0}
          >
            <PracticeIcon width={12} height={12} />
            Practice
          </Link>
          <button
            onClick={startEdit}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
          >
            Rename
          </button>
          <button
            onClick={onDeleted}
            className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}

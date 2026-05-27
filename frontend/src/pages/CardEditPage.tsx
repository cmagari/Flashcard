import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, Subject } from "../api";
import CardEditor from "../components/CardEditor";
import MarkdownView from "../components/MarkdownView";
import TagPicker from "../components/TagPicker";
import { useConfirm } from "../components/Dialog";

export default function CardEditPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const prefillSubjectId = searchParams.get("subject_id");
  const navigate = useNavigate();
  const isNew = !id;
  const confirm = useConfirm();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listSubjects().then((ss) => {
      setSubjects(ss);
      if (isNew && subjectId == null) {
        const requested = prefillSubjectId ? Number(prefillSubjectId) : NaN;
        const match = ss.find((s) => s.id === requested);
        if (match) setSubjectId(match.id);
        else if (ss.length > 0) setSubjectId(ss[0].id);
      }
    });
  }, [isNew, subjectId, prefillSubjectId]);

  useEffect(() => {
    if (!id) return;
    api
      .getCard(Number(id))
      .then((c) => {
        setSubjectId(c.subject_id);
        setFront(c.front_md);
        setBack(c.back_md);
        setTagNames(c.tags);
      })
      .catch((err) => setError((err as Error).message));
  }, [id]);

  async function save() {
    if (subjectId == null) {
      setError("Pick a subject first");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.createCard({
          subject_id: subjectId,
          front_md: front,
          back_md: back,
          tag_names: tagNames,
        });
        setFront("");
        setBack("");
        setError(null);
      } else {
        await api.updateCard(Number(id), {
          subject_id: subjectId,
          front_md: front,
          back_md: back,
          tag_names: tagNames,
        });
        setError(null);
        navigate(-1);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    const ok = await confirm({
      title: "Delete card?",
      message: "This card will be permanently deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteCard(Number(id));
      navigate("/cards");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-400">
        Create a subject first under <a className="text-blue-400 underline" href="#/subjects">Subjects</a>.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">{isNew ? "New card" : "Edit card"}</h1>
        <div className="flex-1" />
        {!isNew && (
          <button
            onClick={remove}
            className="rounded border border-red-900 px-3 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
          >
            Delete
          </button>
        )}
        <button
          onClick={() => navigate(-1)}
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
            value={subjectId ?? ""}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
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
            <div className="min-h-[8rem] rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
              <MarkdownView source={front} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-zinc-400">Back preview</span>
            <div className="min-h-[8rem] rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
              <MarkdownView source={back} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

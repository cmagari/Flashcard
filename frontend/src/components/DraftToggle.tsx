const DRAFT_HINT =
  "Drafts stay in your library and stay editable, but never come up in practice.";

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
}

export default function DraftToggle({ value, onChange }: Props) {
  return (
    <label
      className="flex cursor-pointer select-none items-center gap-2 text-sm"
      title={DRAFT_HINT}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-amber-500"
      />
      <span className={value ? "text-amber-300" : "text-zinc-400"}>Draft</span>
    </label>
  );
}

export function DraftBadge() {
  return (
    <span
      className="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-200"
      title={DRAFT_HINT}
    >
      Draft
    </span>
  );
}

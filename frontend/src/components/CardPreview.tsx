import MarkdownView from "./MarkdownView";

interface Props {
  source: string;
  label: string;
  emptyText?: string;
}

export default function CardPreview({ source, label, emptyText = "(empty)" }: Props) {
  const empty = !source || source.trim() === "";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="markdown-mini relative h-24 overflow-hidden rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5">
        {empty ? (
          <em className="text-xs text-zinc-600">{emptyText}</em>
        ) : (
          <MarkdownView source={source} />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>
    </div>
  );
}

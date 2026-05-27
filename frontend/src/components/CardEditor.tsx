import { useRef } from "react";
import { api } from "../api";
import { useAlert } from "./Dialog";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

export default function CardEditor({ label, value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const alert = useAlert();

  function insertAtCursor(text: string) {
    const ta = ref.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + text.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  function wrap(open: string, close: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + open + sel + close + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      if (start === end) {
        const cursor = start + open.length;
        ta.setSelectionRange(cursor, cursor);
      } else {
        ta.setSelectionRange(start + open.length, end + open.length);
      }
    });
  }

  const pairs: Record<string, [string, string]> = {
    $: ["$", "$"],
    "{": ["{", "}"],
    "[": ["[", "]"],
    "(": ["(", ")"],
  };

  const oneArgCmds = new Set([
    "\\sqrt", "\\vec", "\\hat", "\\bar", "\\tilde", "\\dot", "\\ddot",
    "\\widehat", "\\widetilde", "\\overline", "\\underline",
    "\\mathrm", "\\mathbf", "\\mathit", "\\mathbb", "\\mathcal",
    "\\mathfrak", "\\mathsf", "\\mathtt", "\\boldsymbol",
    "\\text", "\\textbf", "\\textit",
    "\\sin", "\\cos", "\\tan", "\\cot", "\\sec", "\\csc",
    "\\log", "\\ln", "\\exp",
  ]);

  const twoArgCmds = new Set([
    "\\frac", "\\tfrac", "\\dfrac", "\\cfrac",
    "\\binom", "\\dbinom", "\\tbinom",
    "\\stackrel", "\\overset", "\\underset",
  ]);

  function inMathContext(text: string, pos: number): boolean {
    let i = 0;
    let mode: "text" | "inline" | "block" = "text";
    while (i < pos) {
      const ch = text[i];
      if (ch === "\\" && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (ch === "$") {
        const isDouble = text[i + 1] === "$";
        if (mode === "text") {
          mode = isDouble ? "block" : "inline";
          i += isDouble ? 2 : 1;
        } else if (mode === "block") {
          if (isDouble) { mode = "text"; i += 2; } else { i += 1; }
        } else {
          mode = "text";
          i += 1;
        }
        continue;
      }
      i += 1;
    }
    return mode !== "text";
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); wrap("**", "**"); return; }
      if (k === "i") { e.preventDefault(); wrap("*", "*"); return; }
      if (k === "u") { e.preventDefault(); wrap("<u>", "</u>"); return; }
    }
    const ta = ref.current;
    if (!ta) return;

    if (
      (e.key === "}" || e.key === "]" || e.key === ")" || e.key === "$") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      ta.selectionStart === ta.selectionEnd &&
      value[ta.selectionStart] === e.key
    ) {
      const pos = ta.selectionStart;
      e.preventDefault();
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(pos + 1, pos + 1);
      });
      return;
    }

    if (
      /^[a-zA-Z]$/.test(e.key) &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      ta.selectionStart === ta.selectionEnd
    ) {
      const start = ta.selectionStart;
      if (inMathContext(value, start)) {
        const match = (value.slice(0, start) + e.key).match(/\\[a-zA-Z]+$/);
        if (match) {
          const cmd = match[0];
          const tail = twoArgCmds.has(cmd) ? "{}{}" : oneArgCmds.has(cmd) ? "{}" : null;
          if (tail) {
            e.preventDefault();
            const next = value.slice(0, start) + e.key + tail + value.slice(start);
            onChange(next);
            requestAnimationFrame(() => {
              ta.focus();
              const cursor = start + e.key.length + 1;
              ta.setSelectionRange(cursor, cursor);
            });
            return;
          }
        }
      }
    }

    const pair = pairs[e.key];
    if (!pair) return;
    if (ta.selectionStart !== ta.selectionEnd) {
      e.preventDefault();
      wrap(pair[0], pair[1]);
    } else if (e.key !== "$" && inMathContext(value, ta.selectionStart)) {
      e.preventDefault();
      wrap(pair[0], pair[1]);
    }
  }

  async function uploadAndInsert(promise: Promise<{ filename: string }>) {
    try {
      const uploaded = await promise;
      insertAtCursor(`![](app-image://${uploaded.filename})`);
    } catch (err) {
      alert({
        title: "Image upload failed",
        message: (err as Error).message,
      });
    }
  }

  function handleFile(file: File) {
    uploadAndInsert(api.uploadImage(file));
  }

  function handleUrl(url: string) {
    uploadAndInsert(api.uploadImageFromUrl(url));
  }

  function extractImageUrl(dt: DataTransfer): string | null {
    const direct = dt.getData("text/uri-list") || dt.getData("text/x-moz-url");
    if (direct) {
      const first = direct.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
      if (first && /^https?:\/\//i.test(first)) return first;
    }
    const html = dt.getData("text/html");
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m && /^https?:\/\//i.test(m[1])) return m[1];
    }
    const plain = dt.getData("text/plain");
    if (plain && /^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?$/i.test(plain.trim())) {
      return plain.trim();
    }
    return null;
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            handleFile(f);
            return;
          }
        }
      }
    }
    const url = e.clipboardData ? extractImageUrl(e.clipboardData) : null;
    if (url) {
      e.preventDefault();
      handleUrl(url);
    }
  }

  function onDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = dt.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        handleFile(file);
        return;
      }
    }
    const url = extractImageUrl(dt);
    if (url) {
      e.preventDefault();
      handleUrl(url);
    }
  }

  return (
    <label className="flex flex-col gap-1 flex-1 min-h-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex-1 min-h-[8rem] resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Markdown supported. Paste or drop images. $E=mc^2$ inline, $$\\int x dx$$ block."
      />
    </label>
  );
}

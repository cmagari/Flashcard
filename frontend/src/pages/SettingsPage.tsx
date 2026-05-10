import { useEffect, useState } from "react";
import { api, AppInfo } from "../api";
import { useAlert, useConfirm } from "../components/Dialog";

export default function SettingsPage() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const alert = useAlert();
  const confirm = useConfirm();
  const canOpen = typeof window !== "undefined" && !!window.flashcardApi?.openPath;

  function refreshOrphans() {
    api
      .listOrphanImages()
      .then((r) => setOrphanCount(r.count))
      .catch(() => setOrphanCount(null));
  }

  useEffect(() => {
    api
      .info()
      .then(setInfo)
      .catch((err) => setError((err as Error).message));
    refreshOrphans();
  }, []);

  async function runCleanup() {
    if (orphanCount == null || orphanCount === 0) return;
    const ok = await confirm({
      title: `Delete ${orphanCount} orphan image${orphanCount === 1 ? "" : "s"}?`,
      message:
        "These image files exist in the storage folder but aren't referenced by any card (e.g. dropped in the editor without saving the card). They'll be permanently deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setCleaning(true);
    try {
      const result = await api.cleanupOrphanImages();
      setOrphanCount(0);
      alert({
        title: "Cleanup complete",
        message: `Deleted ${result.deleted} orphan image${result.deleted === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      alert({ title: "Cleanup failed", message: (err as Error).message });
    } finally {
      setCleaning(false);
    }
  }

  async function open(path: string) {
    if (!window.flashcardApi?.openPath) {
      alert({
        title: "Open path unavailable",
        message:
          "Opening folders requires running inside the Electron app. The path is shown above — copy it manually.",
      });
      return;
    }
    try {
      const result = await window.flashcardApi.openPath(path);
      if (result) {
        alert({ title: "Could not open folder", message: String(result) });
      }
    } catch (err) {
      alert({ title: "Could not open folder", message: (err as Error).message });
    }
  }

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3 rounded border border-zinc-800 p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-base font-medium text-zinc-100">Image cleanup</h2>
          <button
            onClick={refreshOrphans}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </header>
        <p className="text-sm text-zinc-400">
          Images are uploaded to disk as soon as you paste/drop them. If you don't end up
          saving the card, those files are left behind. This finds and removes them.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {orphanCount === null
              ? "Checking…"
              : orphanCount === 0
                ? "No orphan images."
                : `${orphanCount} orphan image${orphanCount === 1 ? "" : "s"} found.`}
          </span>
          <div className="flex-1" />
          <button
            onClick={runCleanup}
            disabled={cleaning || !orphanCount}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {cleaning ? "Cleaning…" : "Clean up"}
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded border border-zinc-800 p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-base font-medium text-zinc-100">Storage</h2>
          <span className="text-xs text-zinc-500">
            All flashcards, attempts, and images live here.
          </span>
        </header>
        {info ? (
          <div className="space-y-2">
            <PathRow
              label="App data folder"
              path={info.data_dir}
              canOpen={canOpen}
              onOpen={() => open(info.data_dir)}
              onCopy={() => copy(info.data_dir)}
            />
            <PathRow
              label="Database"
              path={info.db_path}
              canOpen={canOpen}
              onOpen={() => open(info.data_dir)}
              onCopy={() => copy(info.db_path)}
              openLabel="Reveal folder"
            />
            <PathRow
              label="Images folder"
              path={info.images_dir}
              canOpen={canOpen}
              onOpen={() => open(info.images_dir)}
              onCopy={() => copy(info.images_dir)}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
      </section>
    </div>
  );
}

interface PathRowProps {
  label: string;
  path: string;
  canOpen: boolean;
  onOpen: () => void;
  onCopy: () => void;
  openLabel?: string;
}

function PathRow({ label, path, canOpen, onOpen, onCopy, openLabel = "Open" }: PathRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
          {path}
        </code>
        <button
          onClick={onCopy}
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
          title="Copy path to clipboard"
        >
          Copy
        </button>
        <button
          onClick={onOpen}
          disabled={!canOpen}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium hover:bg-blue-500 disabled:opacity-50"
          title={canOpen ? `${openLabel} in file manager` : "Only available in the Electron app"}
        >
          {openLabel}
        </button>
      </div>
    </div>
  );
}

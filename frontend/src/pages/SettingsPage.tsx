import { useEffect, useState } from "react";
import { api, AppInfo, BackupInfo, setApiBaseUrl } from "../api";
import { useAlert, useConfirm } from "../components/Dialog";

export default function SettingsPage() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [override, setOverride] = useState<string | null>(null);
  const [changingDir, setChangingDir] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const alert = useAlert();
  const confirm = useConfirm();
  const canOpen = typeof window !== "undefined" && !!window.flashcardApi?.openPath;
  const canChooseDir =
    typeof window !== "undefined" && !!window.flashcardApi?.chooseDataDir;
  const canRestore =
    typeof window !== "undefined" && !!window.flashcardApi?.restoreBackup;

  function refreshOrphans() {
    api
      .listOrphanImages()
      .then((r) => setOrphanCount(r.count))
      .catch(() => setOrphanCount(null));
  }

  function refreshInfo() {
    api
      .info()
      .then(setInfo)
      .catch((err) => setError((err as Error).message));
  }

  function refreshOverride() {
    window.flashcardApi
      ?.getDataDirOverride?.()
      .then((v) => setOverride(v))
      .catch(() => setOverride(null));
  }

  function refreshBackups() {
    if (!window.flashcardApi?.listBackups) {
      setBackups([]);
      return;
    }
    window.flashcardApi
      .listBackups()
      .then((rows) => setBackups(rows))
      .catch(() => setBackups([]));
  }

  useEffect(() => {
    refreshInfo();
    refreshOrphans();
    refreshOverride();
    refreshBackups();
  }, []);

  async function chooseFolder() {
    if (!window.flashcardApi?.chooseDataDir || !window.flashcardApi?.setDataDir) return;
    try {
      const picked = await window.flashcardApi.chooseDataDir();
      if (!picked) return;
      const ok = await confirm({
        title: "Use this folder for Flashcard data?",
        message: `${picked}\n\nThe backend will restart and read existing flashcards.db / images from this folder (creating them if absent). Cards stored in the previous folder will not be visible until you switch back.`,
        confirmLabel: "Use folder",
      });
      if (!ok) return;
      setChangingDir(true);
      const newBase = await window.flashcardApi.setDataDir(picked);
      setApiBaseUrl(newBase);
      setOverride(picked);
      refreshInfo();
      refreshOrphans();
    } catch (err) {
      alert({ title: "Could not change data folder", message: (err as Error).message });
    } finally {
      setChangingDir(false);
    }
  }

  async function resetFolder() {
    if (!window.flashcardApi?.resetDataDir) return;
    const ok = await confirm({
      title: "Reset to default data folder?",
      message:
        "The backend will restart and use the default app-data folder. Cards in the custom folder will remain on disk but won't be visible until you switch back.",
      confirmLabel: "Reset",
    });
    if (!ok) return;
    try {
      setChangingDir(true);
      const newBase = await window.flashcardApi.resetDataDir();
      setApiBaseUrl(newBase);
      setOverride(null);
      refreshInfo();
      refreshOrphans();
    } catch (err) {
      alert({ title: "Could not reset data folder", message: (err as Error).message });
    } finally {
      setChangingDir(false);
    }
  }

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

  async function restoreFromBackup(b: BackupInfo) {
    if (!window.flashcardApi?.restoreBackup) return;
    const ok = await confirm({
      title: "Restore this backup?",
      message: `flashcards.db will be replaced with the contents of ${b.filename}. The current database is renamed to flashcards-replaced-<timestamp>.db so it isn't lost.`,
      confirmLabel: "Restore",
      destructive: true,
    });
    if (!ok) return;
    setRestoring(true);
    try {
      const newBase = await window.flashcardApi.restoreBackup(b.filename);
      setApiBaseUrl(newBase);
      refreshInfo();
      refreshOrphans();
      refreshBackups();
      alert({
        title: "Restore complete",
        message: "The backup has been restored and the backend is back online.",
      });
    } catch (err) {
      alert({
        title: "Restore failed",
        message: (err as Error).message,
      });
    } finally {
      setRestoring(false);
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
          <h2 className="text-base font-medium text-zinc-100">Data folder</h2>
          <span
            className={
              "rounded px-2 py-0.5 text-xs " +
              (override
                ? "bg-blue-900/40 text-blue-200"
                : "bg-zinc-800 text-zinc-400")
            }
          >
            {override ? "Custom" : "Default"}
          </span>
        </header>
        <p className="text-sm text-zinc-400">
          Pick a custom folder to use as the storage location for{" "}
          <code className="text-zinc-300">flashcards.db</code> and{" "}
          <code className="text-zinc-300">images/</code>. The choice persists across
          launches. Changing folders restarts the backend.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={chooseFolder}
            disabled={!canChooseDir || changingDir}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            title={canChooseDir ? "Choose a folder" : "Only available in the Electron app"}
          >
            {changingDir ? "Switching…" : "Choose folder…"}
          </button>
          <button
            onClick={resetFolder}
            disabled={!override || changingDir}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
            title={override ? "Reset to default" : "Already using the default folder"}
          >
            Reset to default
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded border border-zinc-800 p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-base font-medium text-zinc-100">Backups</h2>
          <button
            onClick={refreshBackups}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </header>
        <p className="text-sm text-zinc-400">
          A snapshot of <code className="text-zinc-300">flashcards.db</code> is
          taken automatically when the app closes. The 3 most recent are kept;
          older ones are pruned. Restore replaces the live database with the
          snapshot — the previous file is renamed (not deleted) so you can roll
          back if needed.
        </p>
        {!canRestore && (
          <p className="text-xs text-zinc-500">
            Restore is only available when running inside the Electron app.
          </p>
        )}
        {backups === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No backups yet — one will be saved next time you close the app.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
            {backups.map((b) => (
              <li
                key={b.filename}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
              >
                <div className="flex flex-1 flex-col">
                  <span className="text-zinc-200">
                    {new Date(b.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {b.filename} · {formatBytes(b.size_bytes)}
                  </span>
                </div>
                <button
                  onClick={() => restoreFromBackup(b)}
                  disabled={!canRestore || restoring}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
                >
                  {restoring ? "Restoring…" : "Restore"}
                </button>
              </li>
            ))}
          </ul>
        )}
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
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

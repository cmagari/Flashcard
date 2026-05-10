import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface BaseOpts {
  title?: string;
  message: string;
}

interface ConfirmOpts extends BaseOpts {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface AlertOpts extends BaseOpts {
  okLabel?: string;
}

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;
type AlertFn = (opts: AlertOpts | string) => Promise<void>;

interface Ctx {
  confirm: ConfirmFn;
  alert: AlertFn;
}

const DialogContext = createContext<Ctx | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm requires <DialogProvider>");
  return ctx.confirm;
}

export function useAlert(): AlertFn {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useAlert requires <DialogProvider>");
  return ctx.alert;
}

type Pending =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "alert"; resolve: () => void } & AlertOpts);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) =>
        setPending({ kind: "confirm", resolve, ...opts }),
      ),
    [],
  );

  const alert = useCallback<AlertFn>(
    (opts) =>
      new Promise<void>((resolve) =>
        setPending({
          kind: "alert",
          resolve,
          ...(typeof opts === "string" ? { message: opts } : opts),
        }),
      ),
    [],
  );

  function resolveWith(val: boolean) {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(val);
    else pending.resolve();
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        resolveWith(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        resolveWith(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const destructive = pending?.kind === "confirm" && pending.destructive;
  const primaryClass = destructive
    ? "bg-red-700 hover:bg-red-600"
    : "bg-blue-600 hover:bg-blue-500";

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) resolveWith(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={pending.title ? "dialog-title" : undefined}
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
          >
            {pending.title && (
              <h2
                id="dialog-title"
                className="mb-2 text-base font-semibold text-zinc-100"
              >
                {pending.title}
              </h2>
            )}
            <p className="whitespace-pre-line text-sm text-zinc-300">
              {pending.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {pending.kind === "confirm" && (
                <button
                  onClick={() => resolveWith(false)}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  {pending.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                autoFocus
                onClick={() => resolveWith(true)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${primaryClass}`}
              >
                {pending.kind === "confirm"
                  ? pending.confirmLabel || "Confirm"
                  : pending.okLabel || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

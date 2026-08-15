import { ReactNode, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the close button so Escape works immediately, and so page-level
    // key handlers (Practice listens for Space / 1 / 2 / 3 on window) see a
    // target inside this dialog and bail out.
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Flashcard works"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
          <h2 className="text-base font-semibold">How Flashcard works</h2>
          <div className="flex-1" />
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 overflow-auto px-5 py-4 text-sm leading-relaxed text-zinc-300">
          <p className="text-zinc-400">
            Everything lives on this machine — there is no account and no server.
            Your cards, images, and practice history sit in a folder you can see
            and back up from Settings.
          </p>

          <Section title="The loop">
            <p>
              Make a <strong className="text-zinc-100">subject</strong>, fill it
              with <strong className="text-zinc-100">cards</strong>, then{" "}
              <strong className="text-zinc-100">practice</strong>. Each answer you
              grade feeds the app's picture of what you know, which is what Home
              and smart mode read from.
            </p>
          </Section>

          <Section title="Subjects">
            <p>
              Subjects are the top-level grouping — one per topic you're studying.
              Open a subject to see just its cards, select several at once to move
              or duplicate them, and give it a description if the name isn't
              enough on its own. For material you only want occasionally, edit
              the subject and turn off <strong className="text-zinc-100">Include
              in general practice by default</strong>. It will then appear as
              opt-in on the Practice screen and is only used when selected.
            </p>
          </Section>

          <Section title="Cards">
            <p>
              A card is a front and a back, both written in Markdown. Math works
              with <Code>$E=mc^2$</Code> inline and <Code>$$…$$</Code> for a block.
              A live preview sits beside the editor as you type.
            </p>
            <p>
              Paste or drop an image straight into the editor — including dragging
              one off a web page — and it is copied into your images folder. Press{" "}
              <Code>Enter</Code> inside a list and the next bullet or number is
              written for you.
            </p>
            <p>
              <strong className="text-zinc-100">Tags</strong> cut across subjects,
              so you can practice "formulas" from every topic at once.
            </p>
          </Section>

          <Section title="Drafts">
            <p>
              Tick <strong className="text-amber-300">Draft</strong> on a
              half-finished card. It stays in your library and stays editable, but
              never comes up in practice and is left out of the mastery numbers.
              Home shows how many are outstanding and links straight to them.
            </p>
          </Section>

          <Section title="Practice">
            <p>
              With no subjects selected, practice uses every default subject.
              Select subjects explicitly to narrow the pool or add an opt-in
              subject, then choose how cards are drawn:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong className="text-zinc-100">Random</strong> — an even pick
                from whatever you filtered to.
              </li>
              <li>
                <strong className="text-zinc-100">In order</strong> — oldest card
                first, working forward. Good for a first pass through new material.
              </li>
              <li>
                <strong className="text-zinc-100">Smart</strong> — favours cards
                you've missed recently or haven't seen in a while, and always
                prioritises ones you've never been shown.
              </li>
            </ul>
            <p>
              Flip with <Kbd>Space</Kbd>, then grade yourself: <Kbd>1</Kbd>{" "}
              correct, <Kbd>2</Kbd> incorrect, <Kbd>3</Kbd> skip. Skips aren't
              recorded — only real answers move the needle, and each card keeps its
              last 10.
            </p>
          </Section>

          <Section title="Home">
            <p>
              The bars break each subject down by how well you know it — memorized,
              familiar, learning, and new. <strong className="text-zinc-100">
              Needs review</strong> is the queue smart mode would reach for next,
              so it's the fastest way in when you don't know where to start.
            </p>
          </Section>

          <Section title="Settings">
            <p>
              The full keyboard shortcut list, the folder your data lives in,
              automatic backups taken when you close the app, and a cleanup tool
              for images left behind by cards you never saved.
            </p>
          </Section>
        </div>

        <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
          Looking for the shortcut list?{" "}
          <Link
            to="/settings"
            onClick={onClose}
            className="text-blue-300 hover:underline"
          >
            Settings → Keyboard shortcuts
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200">
      {children}
    </code>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

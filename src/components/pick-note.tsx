"use client";

import { useState, useTransition } from "react";
import { savePickNoteAction, saveSuggestionAction, type PickResult } from "@/app/members/actions";
import { fill, getMessages } from "@/src/lib/messages";
import type { NoteKind, PickNote } from "@/src/lib/team-round";

const t = getMessages();
const r = t.round;
const NOTE_MAX = 280;
const SUGGESTION_MAX = 500;
const KINDS: NoteKind[] = ["comment", "suggestion"];
const errorText = (res: PickResult) =>
  res.ok ? "" : ((r.errors as Record<string, string>)[res.code] ?? r.saveError);
const length = (s: string) => [...s.trim()].length;

/**
 * A comment or suggestion on one ticked design, inside the review sheet. Only designs in
 * the member's picks get one (the server checks that too), and a removed pick takes its
 * note with it.
 */
export function PickNoteEditor({
  roundId,
  designId,
  title,
  value,
  onSaved,
}: {
  roundId: string;
  designId: string;
  title: string;
  value: PickNote | undefined;
  onSaved: (next: PickNote | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<NoteKind>(value?.kind ?? "comment");
  const [text, setText] = useState(value?.note ?? "");
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  const id = `note-${designId}`;

  const save = (note: string) =>
    start(async () => {
      setError("");
      const res = await savePickNoteAction({ roundId, designId, note, kind });
      if (!res.ok) return setError(errorText(res));
      const trimmed = note.trim();
      onSaved(trimmed ? { note: trimmed, kind } : undefined);
      setEditing(false);
    });

  if (!editing) {
    return value ? (
      <div className="mt-2 rounded-xl bg-[var(--bg)] p-2.5 text-sm">
        <span
          className={`mr-2 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
            value.kind === "suggestion" ? "bg-teal text-onyx" : "bg-gold text-onyx"
          }`}
        >
          {r.noteKinds[value.kind]}
        </span>
        <span className="break-words whitespace-pre-line">{value.note}</span>
        <button
          type="button"
          onClick={() => {
            setKind(value.kind);
            setText(value.note);
            setEditing(true);
          }}
          aria-label={`${r.noteEdit}: ${title}`}
          className="ml-1 min-h-8 px-1 text-xs text-[var(--muted)] underline underline-offset-2"
        >
          {r.noteEdit}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${r.noteAdd}: ${title}`}
        className="mt-1 min-h-10 rounded-full px-1 text-left text-xs font-semibold text-[var(--accent)]"
      >
        + {r.noteAdd}
      </button>
    );
  }

  const left = NOTE_MAX - length(text);
  return (
    <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-2.5">
      <div role="radiogroup" aria-label={r.noteAdd} className="flex gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
              kind === k
                ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
                : "border-[var(--line)]"
            }`}
          >
            {r.noteKinds[k]}
          </button>
        ))}
      </div>
      <label htmlFor={id} className="sr-only">
        {`${r.noteKinds[kind]}: ${title}`}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={NOTE_MAX}
        rows={3}
        placeholder={r.notePlaceholder[kind]}
        aria-describedby={`${id}-hint`}
        className="mt-2 block w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--card)] p-2 text-base"
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--muted)]">
        {fill(r.noteHint, { left })}
      </p>
      {error && (
        <p role="alert" className="text-coral mt-1 text-xs">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save(text)}
          disabled={saving || left < 0 || (!text.trim() && !value)}
          className="bg-gold text-onyx min-h-10 rounded-full px-4 text-sm font-bold disabled:opacity-40"
        >
          {r.noteSave}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="min-h-10 rounded-full border border-[var(--line)] px-4 text-sm"
        >
          {r.noteCancel}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => save("")}
            disabled={saving}
            className="min-h-10 px-2 text-xs text-[var(--muted)] underline underline-offset-2"
          >
            {r.noteDelete}
          </button>
        )}
      </div>
    </div>
  );
}

/** One free suggestion for the round, not tied to a design. */
export function SuggestionBox({ roundId, initial }: { roundId: string; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  const dirty = text.trim() !== saved.trim();

  const save = () =>
    start(async () => {
      setError("");
      const res = await saveSuggestionAction(roundId, text);
      if (!res.ok) return setError(errorText(res));
      setSaved(text);
    });

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-3">
      <label htmlFor="round-suggestion" className="font-bold">
        {r.suggestionTitle}
      </label>
      <p id="round-suggestion-hint" className="mt-1 text-xs text-[var(--muted)]">
        {r.suggestionHint}
      </p>
      <textarea
        id="round-suggestion"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={SUGGESTION_MAX}
        rows={3}
        placeholder={r.suggestionPlaceholder}
        aria-describedby="round-suggestion-hint"
        className="mt-2 block w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--card)] p-2 text-base"
      />
      {error && (
        <p role="alert" className="text-coral mt-1 text-xs">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="min-h-10 rounded-full border border-[var(--line)] px-4 text-sm font-bold disabled:opacity-40"
        >
          {r.suggestionSave}
        </button>
        <span role="status" className="font-mono text-xs text-[var(--muted)]">
          {!dirty && saved.trim() ? `✓ ${r.noteSaved}` : ""}
        </span>
      </div>
    </section>
  );
}

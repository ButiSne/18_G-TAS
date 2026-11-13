"use client";

import { useActionState } from "react";
import { buttonPrimary } from "@/src/components/team-ui";
import { getMessages } from "@/src/lib/messages";
import { openRoundAction, type RoundActionResult } from "./actions";

const t = getMessages();
const r = t.round;

/** Draft round settings: picks per person, shortlist size, and who picks. */
export function OpenRoundForm({
  roundId,
  picksPerMember,
  shortlistSize,
  people,
}: {
  roundId: string;
  picksPerMember: number;
  shortlistSize: number;
  people: { id: string; name: string; role: string }[];
}) {
  const [state, action, pending] = useActionState<RoundActionResult | null, FormData>(
    openRoundAction,
    null,
  );
  const field =
    "mt-1 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3";
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="roundId" value={roundId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          {r.picksPerMember}
          <input
            name="picksPerMember"
            type="number"
            min={1}
            max={20}
            defaultValue={picksPerMember}
            inputMode="numeric"
            className={field}
          />
        </label>
        <label className="text-sm">
          {r.shortlistSize}
          <input
            name="shortlistSize"
            type="number"
            min={10}
            max={40}
            defaultValue={shortlistSize}
            inputMode="numeric"
            className={field}
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm">{r.whoPicks}</legend>
        <div className="mt-2 space-y-1">
          {people.map((p) => (
            <label
              key={p.id}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] px-3"
            >
              <input
                type="checkbox"
                name="memberIds"
                value={p.id}
                defaultChecked
                className="size-5 accent-[var(--accent)]"
              />
              <span className="flex-1">{p.name}</span>
              <span className="font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase">
                {p.role === "admin" ? r.adminPicksRole : t.auth.roleMember}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? r.opening : r.open}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-coral text-sm">
          {(r.errors as Record<string, string>)[state.code] ?? r.saveError}
        </p>
      )}
    </form>
  );
}

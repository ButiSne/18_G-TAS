"use client";

import { startTransition, useActionState } from "react";
import { getMessages } from "@/src/lib/messages";

const t = getMessages();

type Result = { ok: true } | { ok: false; code: string };

/**
 * A form bound to a server action that returns { ok } or { ok: false, code }: shows the
 * matching message from messages/en.json, and a pending state on the submit button.
 */
export function ActionForm({
  action,
  children,
  submit,
  pendingLabel = "…",
  okLabel,
  className,
  buttonClassName,
}: {
  action: (prev: Result | null, form: FormData) => Promise<Result>;
  children?: React.ReactNode;
  submit: string;
  pendingLabel?: string;
  okLabel?: string;
  className?: string;
  buttonClassName: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form
      // Submitted by hand, not via the action prop: React 19 resets a form after an action
      // prop runs, which would wipe the admin's choices when a save is refused (e.g. a
      // final ten of 4 + 6). This way the choices stay and can simply be corrected.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
      className={className}
    >
      {children}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : state?.ok && okLabel ? okLabel : submit}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-coral mt-2 text-sm">
          {(t.admin.errors as Record<string, string>)[state.code] ??
            (t.round.errors as Record<string, string>)[state.code] ??
            state.code}
        </p>
      )}
    </form>
  );
}

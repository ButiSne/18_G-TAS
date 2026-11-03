"use client";

import { useState, useTransition } from "react";
import { buttonGhost, buttonPrimary } from "@/src/components/team-ui";
import { formatSATime } from "@/src/lib/format";
import { fill, getMessages } from "@/src/lib/messages";
import { createInviteAction, type InviteResult } from "./actions";

const t = getMessages();

/** Creates a sign-in link and offers to send it on WhatsApp or copy it. */
export function InviteButton({ memberId, hasInvite }: { memberId: string; hasInvite: boolean }) {
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      setCopied(false);
      setResult(await createInviteAction(memberId));
    });

  if (result?.ok) {
    const text = fill(t.auth.inviteText, { name: result.name, url: result.url });
    return (
      <div className="mt-3 space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
        <p className="text-sm text-[var(--muted)]">
          {fill(t.auth.inviteReady, { name: result.name, time: formatSATime(result.expiresAt) })}
        </p>
        <p className="font-mono text-xs break-all select-all">{result.url}</p>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonPrimary}
        >
          {t.auth.sendWhatsApp}
        </a>
        <button
          type="button"
          className={`${buttonGhost} w-full`}
          onClick={async () => {
            await navigator.clipboard.writeText(result.url);
            setCopied(true);
          }}
        >
          {copied ? t.auth.copied : t.auth.copy}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className={`${buttonGhost} mt-3 w-full`}
      >
        {pending ? t.auth.inviteWorking : hasInvite ? t.auth.inviteAgain : t.auth.invite}
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-coral mt-2 text-sm">
          {t.auth.inviteError}
        </p>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { buttonGhost, buttonPrimary } from "@/src/components/team-ui";
import { getMessages } from "@/src/lib/messages";
import { normaliseRef } from "@/src/lib/tally";

const t = getMessages();
const a = t.admin;

/** One vote link per channel (fb, wa-<group>), so results can be read per channel. */
export function ChannelLinks() {
  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);
  const slug = normaliseRef(
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );
  const link = slug ? `${window.location.origin}/vote?ref=${slug}` : "";

  return (
    <div className="mt-3">
      <label className="text-sm">
        {a.linkGroup}
        <input
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setCopied(false);
          }}
          className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3"
        />
      </label>
      {link && (
        <div className="mt-2 space-y-2">
          <p className="font-mono text-xs break-all select-all">{link}</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`18 G-TAS is back! Swipe YEBO or CHA on the new designs: ${link}`)}`}
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
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? t.auth.copied : t.auth.copy}
          </button>
        </div>
      )}
    </div>
  );
}

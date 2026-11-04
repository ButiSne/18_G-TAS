import Image from "next/image";
import Link from "next/link";
import { ActionForm } from "@/src/components/action-form";
import { buttonGhost, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { LINES } from "@/src/lib/design-line";
import { getMessages } from "@/src/lib/messages";
import { PRINT_METHOD_LABELS, PRINT_METHODS } from "@/src/lib/print-methods";
import { adminDesignList } from "@/src/lib/stages";
import { updateDesignAction } from "../stage-actions";

const t = getMessages();
const a = t.admin;

export const metadata = { title: a.designsTitle };

export default async function AdminDesigns() {
  await requireAdmin();
  const designs = await adminDesignList(getDb()!);
  const withMethod = designs.filter((d) => d.printMethod).length;
  const field =
    "mt-1 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2 text-sm";

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <Link
        href="/admin"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
      >
        ← {t.auth.adminTitle}
      </Link>
      <h1 className="font-luxe mt-2 text-4xl">{a.designsTitle}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{a.designsLead}</p>
      <p className="mt-2 font-mono text-xs">
        {a.printMethod}: {withMethod} / {designs.length}
      </p>

      <ul className="mt-6 space-y-3">
        {designs.map((d) => (
          <li
            key={d.id}
            className={`rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3 ${d.hidden ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-3">
              {d.thumbUrl && (
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={d.thumbUrl}
                    alt={d.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold">{d.title}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{d.slug}</p>
              </div>
            </div>
            <ActionForm
              action={updateDesignAction}
              submit={a.save}
              okLabel={`✓ ${a.saved}`}
              buttonClassName={`${buttonGhost} mt-2 w-full`}
              className="mt-2"
            >
              <input type="hidden" name="designId" value={d.id} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  {a.printMethod}
                  <select name="printMethod" defaultValue={d.printMethod ?? ""} className={field}>
                    <option value="">{a.notSet}</option>
                    {PRINT_METHODS.map((p) => (
                      <option key={p} value={p}>
                        {PRINT_METHOD_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  {a.line}
                  <select name="line" defaultValue={d.line} className={field}>
                    {LINES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="hidden" defaultChecked={d.hidden} className="size-5" />
                {a.hidden}
              </label>
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  );
}

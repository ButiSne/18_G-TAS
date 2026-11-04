"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { swatchFor, type CatalogueDesign } from "@/src/lib/catalogue";
import { lineBadge } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";
import { designMeta } from "@/src/lib/print-methods";

const t = getMessages();

/**
 * One card per design family (brief §4): the mockup, its name and line, and a dot per
 * colourway (in the tee's true colour) that switches the image in place. When the pack
 * has a back view, a flip button shows it. `action` is a slot for "Add to picks".
 */
export function DesignCard({
  design,
  priority = false,
  action,
}: {
  design: CatalogueDesign;
  priority?: boolean;
  action?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const c = design.colourways[index] ?? design.colourways[0]!;
  const back = c.views.find((v) => v.label === "Back");
  const image = showBack && back ? back : c;
  const eiteen = design.line === "EITEEN";
  const meta = designMeta(design);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      <div className="relative">
        <Link
          href={`/designs/${design.slug}?c=${index}${showBack && back ? "&v=back" : ""}`}
          className="relative block aspect-[1200/1380]"
        >
          <Image
            src={image.thumbUrl}
            alt={`${fill(t.catalogue.colourwayOf, { design: design.title, colourway: c.name })}${
              showBack && back ? ` (${t.catalogue.backView})` : ""
            }`}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            priority={priority}
            placeholder={c.blurDataUrl ? "blur" : "empty"}
            blurDataURL={c.blurDataUrl ?? undefined}
            className="object-cover"
          />
          <span
            className={`text-onyx absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-widest uppercase ${
              eiteen ? "bg-lime" : "bg-gold"
            }`}
          >
            {lineBadge(design)}
          </span>
        </Link>
        {back && (
          <button
            type="button"
            onClick={() => setShowBack((b) => !b)}
            aria-pressed={showBack}
            aria-label={`${t.catalogue.flip}: ${design.title}`}
            className="absolute top-1 right-1 grid min-h-11 min-w-11 place-items-center px-1"
          >
            <span className="rounded-full bg-black/65 px-2 py-0.5 font-mono text-[9px] tracking-widest whitespace-nowrap text-white uppercase">
              ↻ {showBack ? t.catalogue.front : t.catalogue.back}
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <h2 className="text-sm leading-tight font-bold">{design.title}</h2>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
          {[c.name, ...meta].join(" · ")}
        </p>
        {design.colourways.length > 1 && (
          <div
            className="-mx-1.5 mt-1 flex flex-wrap"
            role="group"
            aria-label={t.catalogue.colourways}
          >
            {design.colourways.map((cw, i) => (
              <button
                key={cw.id}
                type="button"
                onClick={() => {
                  setIndex(i);
                  setShowBack(false);
                }}
                aria-pressed={i === index}
                aria-label={cw.name}
                title={cw.name}
                className="grid size-8 place-items-center rounded-full"
              >
                <span
                  className={`block size-4 rounded-full ring-1 ring-black/20 ${
                    i === index ? "outline-2 outline-offset-2 outline-[var(--accent)]" : ""
                  }`}
                  style={{ background: swatchFor(cw.teeColour, cw.teeHex) }}
                />
              </button>
            ))}
          </div>
        )}
        {action}
      </div>
    </article>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  aboutYouAction,
  numberOneAction,
  startVotingAction,
  swipeAction,
  undoAction,
  type VoteResult,
} from "@/app/vote/actions";
import { lineBadge } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";
import { SITE_URL } from "@/src/lib/site";
import type { PublicEntryCard } from "@/src/lib/stages";
import { styleFor } from "@/src/lib/style";
import { AGE_BRACKETS, PROVINCES } from "@/src/lib/demographics";

const t = getMessages();
const v = t.vote;
const errorText = (code: string) => (v.errors as Record<string, string>)[code] ?? v.errors.network;

type Swipe = { entryId: string; liked: boolean };
type Phase = "intro" | "deck" | "pick" | "done";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void },
      ) => void;
    };
  }
}

/**
 * The public vote (CLAUDE.md §0.7): one full-screen card per design. Swipe right for YEBO,
 * left for CHA, or use the buttons and arrow keys (WCAG 2.5.1). Then "your number one"
 * and a "your style" card to share. Every swipe saves straight away.
 */
export function SwipeDeck({
  cards,
  siteKey,
  refCode,
  initial,
}: {
  cards: PublicEntryCard[];
  siteKey: string | null;
  refCode: string | null;
  initial: { started: boolean; order: string[]; swipes: Swipe[]; numberOne: string | null };
}) {
  const byId = useMemo(() => new Map(cards.map((c) => [c.entryId, c])), [cards]);
  const [order, setOrder] = useState(initial.order);
  const [swipes, setSwipes] = useState<Swipe[]>(initial.swipes);
  const [numberOne, setNumberOne] = useState(initial.numberOne);
  const [phase, setPhase] = useState<Phase>(() => {
    if (initial.numberOne) return "done";
    if (!initial.started) return "intro";
    return initial.swipes.length >= initial.order.length ? "pick" : "deck";
  });
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const widget = useRef<HTMLDivElement>(null);

  const swiped = new Set(swipes.map((s) => s.entryId));
  const remaining = order.filter((id) => !swiped.has(id));
  const liked = swipes
    .filter((s) => s.liked)
    .map((s) => byId.get(s.entryId)!)
    .filter(Boolean);

  const call = (fn: () => Promise<VoteResult>, undo?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          undo?.();
          setError(errorText(res.code));
        }
      } catch {
        undo?.();
        setError(v.errors.network);
      }
    });

  const begin = () =>
    start(async () => {
      setError("");
      const res = await startVotingAction(turnstileToken);
      if (!res.ok) return setError(errorText(res.code));
      setOrder(res.order);
      setSwipes(res.swipes);
      setNumberOne(res.numberOne);
      setPhase(res.numberOne ? "done" : res.swipes.length >= res.order.length ? "pick" : "deck");
    });

  const decide = useCallback(
    (entryId: string, yes: boolean) => {
      setError("");
      navigator.vibrate?.(10);
      const next = [...swipes, { entryId, liked: yes }];
      setSwipes(next);
      if (next.length >= order.length) setPhase(next.some((s) => s.liked) ? "pick" : "done");
      call(
        () => swipeAction(entryId, yes, refCode),
        () => setSwipes((s) => s.filter((x) => x.entryId !== entryId)),
      );
    },
    [swipes, order.length, refCode],
  );

  const undo = useCallback(() => {
    const last = swipes.at(-1);
    if (!last) return;
    setSwipes(swipes.slice(0, -1));
    setPhase("deck");
    call(() => undoAction(last.entryId));
  }, [swipes]);

  // Keyboard: ← CHA, → YEBO, Z undo.
  useEffect(() => {
    if (phase !== "deck") return;
    const onKey = (e: KeyboardEvent) => {
      const current = remaining[0];
      if (e.key === "ArrowRight" && current) decide(current, true);
      else if (e.key === "ArrowLeft" && current) decide(current, false);
      else if (e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, remaining, decide, undo]);

  if (phase === "intro") {
    return (
      <section className="surface-dark flex min-h-[100svh] flex-col px-4 pt-6 pb-8">
        {siteKey && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onLoad={() =>
              widget.current &&
              window.turnstile?.render(widget.current, {
                sitekey: siteKey,
                callback: setTurnstileToken,
              })
            }
          />
        )}
        <p className="font-numerals text-sm tracking-[0.3em] text-[var(--accent)]">18 G-TAS</p>
        <div className="mx-auto mt-auto w-full max-w-md">
          <p className="text-lime font-mono text-xs tracking-[0.3em] uppercase">{v.introEyebrow}</p>
          <h1 className="font-youth mt-3 text-5xl leading-[0.95]">
            {fill(v.introTitle, { count: cards.length })}
          </h1>
          <p className="mt-4 text-lg text-ivory/85">{v.introBody}</p>
          <div className="mt-6 flex gap-3 font-mono text-sm" aria-hidden>
            <span className="border-coral text-coral rounded-full border-2 px-3 py-1 font-bold">
              ← {v.cha}
            </span>
            <span className="border-lime text-lime rounded-full border-2 px-3 py-1 font-bold">
              {v.yebo} →
            </span>
          </div>
          <div ref={widget} className="mt-6" />
          <button
            type="button"
            onClick={begin}
            disabled={pending || Boolean(siteKey && !turnstileToken)}
            className="bg-gold text-onyx mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 text-lg font-bold transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? v.starting : v.start}
          </button>
          {error && (
            <p role="alert" className="text-coral mt-3 text-sm">
              {error}
            </p>
          )}
          <p className="mt-4 text-center text-xs text-[var(--muted)]">
            {v.privacyNote}{" "}
            <Link href="/privacy#data" className="underline">
              {v.privacyLink}
            </Link>
          </p>
        </div>
      </section>
    );
  }

  if (phase === "deck") {
    const current = remaining[0] ? byId.get(remaining[0]) : undefined;
    const next = remaining[1] ? byId.get(remaining[1]) : undefined;
    const after = remaining[2] ? byId.get(remaining[2]) : undefined;
    return (
      // Fixed to the screen while voting, like an app: a vertical swipe can't scroll the page
      // or reveal the footer mid-deck.
      <section className="surface-dark fixed inset-0 z-30 flex flex-col overflow-hidden px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-1 font-mono text-xs">
          <span className="font-numerals tracking-[0.3em] text-[var(--accent)]">18 G-TAS</span>
          <span aria-live="polite">
            {fill(v.progress, { done: swipes.length + 1, total: order.length })}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="bg-gold h-full transition-all"
            style={{ width: `${(swipes.length / order.length) * 100}%` }}
          />
        </div>
        <div className="relative mt-3 flex-1">
          {next && <CardFace card={next} behind />}
          {after && (
            <Image
              src={after.imageUrl}
              alt=""
              width={1}
              height={1}
              sizes="100vw"
              className="hidden"
              priority={false}
            />
          )}
          {current && (
            <SwipeCard
              key={current.entryId}
              card={current}
              onDecide={(yes) => decide(current.entryId, yes)}
            />
          )}
        </div>
        {error && (
          <p role="alert" className="text-coral mt-2 text-center text-sm">
            {error}
          </p>
        )}
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={undo}
            disabled={!swipes.length}
            aria-label={v.undo}
            className="grid size-12 place-items-center rounded-full border border-white/20 text-lg disabled:opacity-30"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => current && decide(current.entryId, false)}
            aria-label={v.cha}
            className="border-coral text-coral grid size-16 place-items-center rounded-full border-2 font-mono text-sm font-bold"
          >
            {v.cha}
          </button>
          <button
            type="button"
            onClick={() => current && decide(current.entryId, true)}
            aria-label={v.yebo}
            className="border-lime text-lime grid size-16 place-items-center rounded-full border-2 font-mono text-sm font-bold"
          >
            {v.yebo}
          </button>
          {current && (
            <a
              href={current.imageUrl}
              target="_blank"
              rel="noopener"
              aria-label={`${v.zoom}: ${current.title}`}
              className="grid size-12 place-items-center rounded-full border border-white/20 text-lg"
            >
              ⤢
            </a>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">{v.hint}</p>
      </section>
    );
  }

  if (phase === "pick") {
    return (
      <section className="surface-dark min-h-[100svh] px-4 pt-8 pb-10">
        <div className="mx-auto max-w-md">
          <h1 className="font-youth text-4xl leading-tight">{v.pickTitle}</h1>
          <p className="mt-2 text-[var(--muted)]">{v.pickBody}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {liked.map((c) => (
              <button
                key={c.entryId}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await numberOneAction(c.entryId, refCode);
                    if (res.ok || res.code === "already_voted") {
                      setNumberOne(c.entryId);
                      setPhase("done");
                    }
                    if (!res.ok) setError(errorText(res.code));
                  })
                }
                className="overflow-hidden rounded-2xl text-left ring-1 ring-white/15 transition active:scale-[0.98]"
              >
                <span className="relative block aspect-[1200/1380]">
                  <Image
                    src={c.thumbUrl}
                    alt={`${c.title}, ${c.colourwayName}`}
                    fill
                    sizes="50vw"
                    className="object-cover"
                  />
                </span>
                <span className="block p-2 text-sm font-bold">{c.title}</span>
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-coral mt-3 text-sm">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => setPhase("done")}
            className="mt-6 min-h-12 w-full rounded-full border border-white/20"
          >
            {v.skip}
          </button>
        </div>
      </section>
    );
  }

  return (
    <Done
      liked={liked}
      total={order.length}
      numberOne={numberOne ? byId.get(numberOne) : undefined}
      refCode={refCode}
      error={error}
    />
  );
}

/** A card image with its name and line, used for the top card and the one peeking behind. */
function CardFace({ card, behind = false }: { card: PublicEntryCard; behind?: boolean }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-3xl bg-[#ececec] ring-1 ring-white/10 ${behind ? "scale-95 opacity-80" : ""}`}
    >
      <Image
        src={card.imageUrl}
        alt={`${card.title}, ${card.colourwayName}`}
        fill
        sizes="100vw"
        priority={!behind}
        placeholder={card.blurDataUrl ? "blur" : "empty"}
        blurDataURL={card.blurDataUrl ?? undefined}
        className="pointer-events-none object-cover select-none"
        draggable={false}
      />
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-4 pt-16 text-white">
        <span
          className={`text-onyx rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${card.line === "EITEEN" ? "bg-lime" : "bg-gold"}`}
        >
          {lineBadge(card)}
        </span>
        <p className="font-youth mt-2 text-3xl leading-tight">{card.title}</p>
        <p className="text-sm text-white/80">{card.colourwayName}</p>
      </div>
    </div>
  );
}

/** The top card: follows the finger, tilts, shows YEBO/CHA, and flies out past a threshold. */
function SwipeCard({
  card,
  onDecide,
}: {
  card: PublicEntryCard;
  onDecide: (yes: boolean) => void;
}) {
  const [dx, setDx] = useState(0);
  const [out, setOut] = useState<0 | 1 | -1>(0);
  const drag = useRef<{ x: number; t: number } | null>(null);
  // Rendering reads this state, never the ref: the card follows the finger without a
  // transition while dragging, and springs back or flies out with one afterwards.
  const [dragging, setDragging] = useState(false);
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = (yes: boolean) => {
    if (reduced) return onDecide(yes);
    setOut(yes ? 1 : -1);
  };

  const x = out ? out * (typeof window !== "undefined" ? window.innerWidth * 1.5 : 800) : dx;
  return (
    <div
      role="group"
      aria-roledescription="swipe card"
      aria-label={`${card.title}, ${card.colourwayName}`}
      className="absolute inset-0 touch-pan-y"
      style={{
        transform: reduced ? undefined : `translateX(${x}px) rotate(${x * 0.06}deg)`,
        transition: dragging ? "none" : "transform 250ms ease-out",
      }}
      onTransitionEnd={() => out && onDecide(out === 1)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, t: performance.now() };
        setDragging(true);
      }}
      onPointerMove={(e) => drag.current && setDx(e.clientX - drag.current.x)}
      onPointerUp={(e) => {
        const start = drag.current;
        drag.current = null;
        setDragging(false);
        if (!start) return;
        const velocity = Math.abs(dx) / Math.max(1, performance.now() - start.t);
        const width = e.currentTarget.offsetWidth;
        if (Math.abs(dx) > width * 0.3 || (Math.abs(dx) > 30 && velocity > 0.5)) finish(dx > 0);
        else setDx(0);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
        setDx(0);
      }}
    >
      <CardFace card={card} />
      <span
        aria-hidden
        className="border-lime text-lime absolute top-8 left-6 -rotate-12 rounded-xl border-4 px-3 py-1 font-mono text-4xl font-bold"
        style={{ opacity: Math.min(1, Math.max(0, x / 100)) }}
      >
        {t.vote.yebo}
      </span>
      <span
        aria-hidden
        className="border-coral text-coral absolute top-8 right-6 rotate-12 rounded-xl border-4 px-3 py-1 font-mono text-4xl font-bold"
        style={{ opacity: Math.min(1, Math.max(0, -x / 100)) }}
      >
        {t.vote.cha}
      </span>
    </div>
  );
}

function Done({
  liked,
  total,
  numberOne,
  refCode,
  error,
}: {
  liked: PublicEntryCard[];
  total: number;
  numberOne?: PublicEntryCard;
  refCode: string | null;
  error: string;
}) {
  const style = styleFor(liked);
  const name = v.styles[style];
  const link = `${SITE_URL}/vote?ref=${refCode ?? "wa-share"}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`${fill(v.shareText, { style: name })} ${link}`)}`;
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const field = "mt-1 block min-h-12 w-full rounded-xl border border-white/20 bg-transparent px-3";

  return (
    <section className="surface-dark min-h-[100svh] px-4 pt-10 pb-10">
      <div className="mx-auto max-w-md">
        <p className="text-lime font-mono text-xs tracking-[0.3em] uppercase">{v.doneEyebrow}</p>
        <h1 className="font-youth text-gold-shimmer mt-2 text-6xl leading-none">{name}</h1>
        <p className="mt-4 text-lg text-ivory/85">
          {fill(v.styleBody[style], { liked: liked.length, total })}
        </p>
        {numberOne && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl p-3 ring-1 ring-white/15">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl">
              <Image src={numberOne.thumbUrl} alt="" fill sizes="64px" className="object-cover" />
            </span>
            <span>
              <span className="block font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase">
                {v.yourOne}
              </span>
              <span className="font-bold">{numberOne.title}</span>
            </span>
          </div>
        )}
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gold text-onyx mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 font-bold"
        >
          {v.share}
        </a>
        {error && (
          <p role="alert" className="text-coral mt-3 text-sm">
            {error}
          </p>
        )}

        <form
          className="mt-8 rounded-2xl p-4 ring-1 ring-white/15"
          action={(form) =>
            start(async () => {
              const res = await aboutYouAction(
                (form.get("age") as string) || null,
                (form.get("province") as string) || null,
              );
              setSaved(res.ok);
            })
          }
        >
          <h2 className="font-bold">{v.aboutYou}</h2>
          <p className="text-sm text-[var(--muted)]">{v.aboutYouBody}</p>
          <label className="mt-3 block text-sm">
            {v.age}
            <select name="age" defaultValue="" className={field}>
              <option value="">{v.preferNot}</option>
              {AGE_BRACKETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            {v.province}
            <select name="province" defaultValue="" className={field}>
              <option value="">{v.preferNot}</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending || saved}
            className="mt-4 min-h-12 w-full rounded-full border border-white/20 font-semibold"
          >
            {saved ? `✓ ${v.savedAbout}` : v.saveAbout}
          </button>
        </form>
        <p className="mt-6 text-center font-mono text-xs text-[var(--muted)]">{v.resultsSoon}</p>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  numberOneAction,
  startVotingAction,
  submitVoteAction,
  swipeAction,
  undoAction,
  type VoteResult,
} from "@/app/vote/actions";
import { lineBadge } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";
import { whatsappShareUrl } from "@/src/lib/site";
import type { PublicEntryCard } from "@/src/lib/stages";
import { readStoredReceipt, storeReceipt } from "@/src/lib/device-memory";
import { rememberedRef } from "@/src/lib/ref-memory";
import { styleFor } from "@/src/lib/style";

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
const noSubscribe = () => () => {};

export function SwipeDeck({
  cards,
  siteKey,
  refCode: refFromUrl,
  initial,
}: {
  cards: PublicEntryCard[];
  siteKey: string | null;
  refCode: string | null;
  initial: {
    started: boolean;
    order: string[];
    swipes: Swipe[];
    numberOne: string | null;
    submitted: boolean;
  };
}) {
  // A vote still counts towards the share link that brought this visitor, even when they
  // reached /vote from another page (src/lib/ref-memory.ts). Null on the server.
  const remembered = useSyncExternalStore(noSubscribe, rememberedRef, () => null);
  const refCode = refFromUrl ?? remembered;
  const byId = useMemo(() => new Map(cards.map((c) => [c.entryId, c])), [cards]);
  const [order, setOrder] = useState(initial.order);
  const [swipes, setSwipes] = useState<Swipe[]>(initial.swipes);
  const [numberOne, setNumberOne] = useState(initial.numberOne);
  // One vote per phone: once submitted, the phone only sees its thank-you and style card.
  const [submitted, setSubmitted] = useState(initial.submitted);
  const [choice, setChoice] = useState<string | null>(initial.numberOne);
  const [phase, setPhase] = useState<Phase>(() => {
    if (initial.submitted) return "done";
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
      const res = await startVotingAction(turnstileToken, readStoredReceipt());
      if (!res.ok) return setError(errorText(res.code));
      storeReceipt(res.receipt);
      setOrder(res.order);
      setSwipes(res.swipes);
      setNumberOne(res.numberOne);
      setChoice(res.numberOne);
      setSubmitted(res.submitted);
      setPhase(res.submitted ? "done" : res.swipes.length >= res.order.length ? "pick" : "deck");
    });

  const decide = useCallback(
    (entryId: string, yes: boolean) => {
      setError("");
      navigator.vibrate?.(10);
      const next = [...swipes, { entryId, liked: yes }];
      setSwipes(next);
      // The last card leads to the submit step, YEBOs or not: nothing counts as final yet.
      if (next.length >= order.length) setPhase("pick");
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
    const locked = Boolean(numberOne); // a number one already saved can't change
    const submit = () =>
      start(async () => {
        setError("");
        try {
          if (choice && !numberOne) {
            const one = await numberOneAction(choice, refCode);
            if (!one.ok && one.code !== "already_voted") return setError(errorText(one.code));
            setNumberOne(choice);
          }
          const res = await submitVoteAction();
          if (res.ok || res.code === "already_submitted") {
            setSubmitted(true);
            setPhase("done");
          } else setError(errorText(res.code));
        } catch {
          setError(v.errors.network);
        }
      });
    return (
      <section className="surface-dark min-h-[100svh] px-4 pt-8 pb-10">
        <div className="mx-auto max-w-md">
          <h1 className="font-youth text-4xl leading-tight">
            {liked.length ? v.pickTitle : v.submitTitle}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {liked.length ? v.pickBodySubmit : v.submitBodyNoLikes}
          </p>
          {liked.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label={v.pickTitle}>
              {liked.map((c) => {
                const on = choice === c.entryId;
                return (
                  <button
                    key={c.entryId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={pending || locked}
                    onClick={() => setChoice(on ? null : c.entryId)}
                    className={`overflow-hidden rounded-2xl text-left transition active:scale-[0.98] ${
                      on ? "ring-gold ring-4" : "ring-1 ring-white/15"
                    }`}
                  >
                    <span className="relative block aspect-[1200/1380]">
                      <Image
                        src={c.thumbUrl}
                        alt={`${c.title}, ${c.colourwayName}`}
                        fill
                        sizes="50vw"
                        className="object-cover"
                      />
                      {on && (
                        <span className="bg-gold text-onyx absolute top-2 right-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                          {v.numberOneBadge}
                        </span>
                      )}
                    </span>
                    <span className="block p-2 text-sm font-bold">{c.title}</span>
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <p role="alert" className="text-coral mt-3 text-sm">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="bg-gold text-onyx mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 text-lg font-bold transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? v.submitting : v.submitVote}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">{v.submitNote}</p>
          <button
            type="button"
            onClick={undo}
            disabled={pending || swipes.length === 0}
            className="mt-4 min-h-12 w-full rounded-full border border-white/20 text-sm"
          >
            ↶ {v.undoLast}
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
      submitted={submitted}
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
  submitted,
}: {
  liked: PublicEntryCard[];
  total: number;
  numberOne?: PublicEntryCard;
  refCode: string | null;
  error: string;
  submitted: boolean;
}) {
  const style = styleFor(liked);
  const name = v.styles[style];
  const share = whatsappShareUrl(
    fill(v.shareText, { style: name }),
    refCode ?? "wa-share",
    "/vote",
  );

  return (
    <section className="surface-dark min-h-[100svh] px-4 pt-10 pb-10">
      <div className="mx-auto max-w-md">
        {submitted && (
          <p
            role="status"
            className="bg-lime/15 text-lime mb-4 rounded-2xl px-3 py-2 text-sm font-bold"
          >
            ✓ {v.voteIn}
          </p>
        )}
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

        <p className="mt-6 text-center font-mono text-xs text-[var(--muted)]">{v.resultsSoon}</p>
      </div>
    </section>
  );
}

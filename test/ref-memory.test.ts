import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberedRef, rememberRef } from "@/src/lib/ref-memory";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("ref memory (the share-link code kept for one tab)", () => {
  it("keeps a valid code, cleaned up, and the latest one wins", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    rememberRef(" WA-Umlazi ");
    expect(rememberedRef()).toBe("wa-umlazi");
    rememberRef("fb");
    expect(rememberedRef()).toBe("fb");
  });

  it("ignores missing or invalid codes", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    rememberRef("fb");
    rememberRef(null);
    rememberRef("<script>");
    expect(rememberedRef()).toBe("fb");
  });

  it("works without storage (private mode): the vote just has no channel", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => rememberRef("fb")).not.toThrow();
    expect(rememberedRef()).toBeNull();
  });
});

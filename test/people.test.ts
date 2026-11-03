import { describe, expect, it } from "vitest";
import { parsePeople } from "@/src/lib/people";

describe("parsePeople", () => {
  it("reads Name <email> and bare emails", () => {
    expect(parsePeople("Thandi <THANDI@example.com>, sipho@example.com")).toEqual([
      { name: "Thandi", email: "thandi@example.com" },
      { name: "sipho", email: "sipho@example.com" },
    ]);
  });

  it("returns nobody for an empty value", () => {
    expect(parsePeople("")).toEqual([]);
    expect(parsePeople(undefined)).toEqual([]);
  });

  it("refuses something that is not an email", () => {
    expect(() => parsePeople("not-an-email")).toThrow();
  });
});

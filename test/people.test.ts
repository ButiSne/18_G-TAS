import { describe, expect, it } from "vitest";
import { parsePeople, withRoles } from "@/src/lib/people";

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

  it("names the person but never echoes the address in errors (POPIA, logs)", () => {
    const attempt = () => parsePeople("Thandi <thandi@example.com>, Lunga M <lunga@example.com");
    expect(attempt).toThrow('Not a valid "Name <email>" entry for Lunga M (missing the closing >)');
    expect(attempt).not.toThrow(/lunga@example\.com/);
  });
});

describe("withRoles", () => {
  const thandi = { name: "Thandi", email: "thandi@example.com" };
  const sipho = { name: "Sipho", email: "sipho@example.com" };

  it("gives admins and members their roles", () => {
    expect(withRoles([thandi], [sipho])).toEqual([
      { ...sipho, role: "member" },
      { ...thandi, role: "admin" },
    ]);
  });

  it("keeps someone in both lists as an admin, once", () => {
    expect(withRoles([thandi], [thandi, sipho])).toEqual([
      { ...thandi, role: "admin" },
      { ...sipho, role: "member" },
    ]);
  });
});

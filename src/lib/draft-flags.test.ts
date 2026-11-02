import { describe, expect, it } from "vitest";
import { findDraftFlags } from "./draft-flags";

const kinds = (message: string, trusted: (string | null)[] = []) =>
  findDraftFlags(message, trusted).map((flag) => flag.kind);

describe("draft flags", () => {
  it("passes a plain message", () => {
    expect(kinds("Hello, I saw you want help with monthly reports. Could we talk?")).toEqual([]);
  });

  it("flags an unknown link but not a trusted one", () => {
    expect(kinds("See https://example.net/urgent-login now")).toEqual(["Link"]);
    expect(kinds("See https://www.spiritustec.com/about", ["https://spiritustec.com/"])).toEqual([]);
    expect(kinds("See https://spiritustec.com.evil.test/about", ["https://spiritustec.com/"])).toEqual(["Link"]);
  });

  it.each([
    ["Email me at a.person@example.test", "Email address"],
    ["Call +263 77 123 4567 today", "Phone number"],
    ["It costs USD 5000", "Price"],
    ["It costs $500", "Price"],
    ["We have helped many firms", "Claim"],
    ["Our results are guaranteed", "Claim"],
    ["Kind regards, [Your name]", "Placeholder"],
  ])("flags %s", (message, kind) => {
    expect(kinds(message)).toContain(kind);
  });

  it("does not treat a date as a phone number", () => {
    expect(kinds("We could talk on 2 November.")).toEqual([]);
  });
});

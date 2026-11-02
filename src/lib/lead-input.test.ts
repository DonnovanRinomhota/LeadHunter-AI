import { describe, expect, it } from "vitest";
import { filtersToQuery, parseLeadFilters } from "./lead-filters";
import { formatDate, priorityLabel, safeWebUrl } from "./lead-labels";
import { MAX_IMPORT_ROWS, parseLeadCsv, parseLeadFields } from "./lead-input";

const source = { type: "manual", keyPrefix: "manual" };

describe("manual lead fields", () => {
  it("cleans up a valid lead", () => {
    const result = parseLeadFields(
      {
        content: " We need help with reporting. ",
        country: "zw",
        url: "",
        published_at: "2026-11-02",
      },
      source,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.originalContent).toBe("We need help with reporting.");
    expect(result.lead.countryCode).toBe("ZW");
    expect(result.lead.sourceUrl).toBeNull();
    expect(result.lead.publishedAt).toBe("2026-11-02T00:00:00Z");
  });

  it("gives the same details the same key, and different details a new one", () => {
    const key = (content: string) => {
      const result = parseLeadFields({ content }, source);
      return result.ok ? result.lead.idempotencyKey : "";
    };
    expect(key("Same")).toBe(key("Same"));
    expect(key("Same")).not.toBe(key("Different"));
  });

  it.each([
    ["missing content", { content: "  " }, "content"],
    ["a bad address", { content: "x", url: "javascript:alert(1)" }, "url"],
    ["a bad country", { content: "x", country: "Zimbabwe" }, "country"],
    ["a bad date", { content: "x", published_at: "soon" }, "published_at"],
  ])("explains %s", (_name, raw, field) => {
    const result = parseLeadFields(raw, source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe(field);
  });
});

describe("CSV import", () => {
  it("numbers rows like a spreadsheet and reports bad rows", () => {
    const parsed = parseLeadCsv(
      "﻿Content,Organisation,Country\nNeeds automation,\"Firm, Ltd\",ZA\n,No content,ZA\nThird,Firm,Zimbabwe\n",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.map((row) => [row.row, row.result.ok])).toEqual([
      [2, true],
      [3, false],
      [4, false],
    ]);
    const first = parsed.rows[0].result;
    if (first.ok) expect(first.lead.organisationName).toBe("Firm, Ltd");
  });

  it("explains a file it cannot use", () => {
    const missing = parseLeadCsv("name,country\nA,ZA\n");
    expect(missing).toEqual({
      ok: false,
      message: "Add a column named content, then upload the file again.",
    });
    expect(parseLeadCsv("content\n").ok).toBe(false);
    const big = `content\n${"x\n".repeat(MAX_IMPORT_ROWS + 1)}`;
    expect(parseLeadCsv(big).ok).toBe(false);
  });
});

describe("lead filters", () => {
  it("keeps valid filters and ignores bad ones", () => {
    expect(
      parseLeadFilters({ status: "qualified", minScore: "60", page: "2", service: "nope" }),
    ).toEqual({ status: "qualified", minScore: 60, page: 2 });
    expect(parseLeadFilters({ status: "bad", minScore: "500", page: "-1" })).toEqual({ page: 1 });
    expect(parseLeadFilters({ minScore: "" })).toEqual({ page: 1 });
  });

  it("builds page links that keep the filters", () => {
    expect(filtersToQuery({ page: 1, status: "new" }, 3)).toBe("?status=new&page=3");
    expect(filtersToQuery({ page: 1 }, 1)).toBe("");
  });
});

describe("lead labels", () => {
  it("names the score bands", () => {
    expect(priorityLabel(null)).toBe("Not scored");
    expect(priorityLabel(80)).toBe("High priority");
    expect(priorityLabel(60)).toBe("Medium priority");
    expect(priorityLabel(59)).toBe("Low priority");
  });

  it("only links to web addresses", () => {
    expect(safeWebUrl("https://x.test")).toBe("https://x.test");
    expect(safeWebUrl("javascript:alert(1)")).toBeNull();
    expect(safeWebUrl(null)).toBeNull();
  });

  it("formats dates", () => {
    expect(formatDate("2026-11-02T00:00:00Z")).toBe("2 Nov 2026");
    expect(formatDate(null)).toBe("Unknown");
  });
});

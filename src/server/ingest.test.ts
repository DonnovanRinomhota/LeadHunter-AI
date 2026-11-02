import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signRequest,
} from "@/contracts/internal-auth";
import { leadIngestSchema } from "@/contracts/ingest";
import { canonicalUrl, contentHash, type IngestRpcClient } from "./ingest";
import { handleIngestRequest } from "./ingest-handler";

const LEAD_ID = "aaaaaaaa-0000-4000-8000-0000000000a1";
const now = new Date("2026-11-02T12:00:00Z");
const timestamp = Math.floor(now.getTime() / 1000);

const lead = {
  idempotencyKey: "test:12345678",
  sourceType: "n8n_test",
  sourceConfigId: null,
  sourceRecordId: "abc",
  sourceUrl: "https://Example.test/post/?utm_source=x&b=2&a=1#top",
  authorHandle: null,
  organisationName: "Example",
  countryCode: "ZA",
  contactChannel: null,
  contactValue: null,
  originalContent: "We need  help.",
  publishedAt: null,
};

function clientReturning(data: unknown, message?: string) {
  const rpc = vi.fn(async () => ({
    data,
    error: message ? { message } : null,
  }));
  return { rpc } as unknown as IngestRpcClient & { rpc: typeof rpc };
}

function signedRequest(body: string, secret = "secret", at = timestamp) {
  return new Request("http://localhost/api/internal/leads", {
    method: "POST",
    body,
    headers: {
      [TIMESTAMP_HEADER]: String(at),
      [SIGNATURE_HEADER]: signRequest(secret, at, body),
    },
  });
}

const deps = (client: IngestRpcClient) => ({
  secret: "secret",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  getClient: () => client,
  now: () => now,
});

describe("POST /api/internal/leads", () => {
  it("creates a lead and passes normalised values to the database", async () => {
    const client = clientReturning([{ outcome: "created", lead_id: LEAD_ID }]);
    const response = await handleIngestRequest(
      signedRequest(JSON.stringify(lead)),
      deps(client),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ outcome: "created", leadId: LEAD_ID });
    expect(client.rpc).toHaveBeenCalledWith(
      "ingest_lead",
      expect.objectContaining({
        p_workspace: "11111111-1111-4111-8111-111111111111",
        p_canonical_url: "https://example.test/post?a=1&b=2",
        p_content_hash: contentHash("we need help."),
      }),
    );
  });

  it("returns 200 for a duplicate", async () => {
    const client = clientReturning([{ outcome: "duplicate", lead_id: LEAD_ID }]);
    const response = await handleIngestRequest(
      signedRequest(JSON.stringify(lead)),
      deps(client),
    );
    expect(response.status).toBe(200);
  });

  it.each([
    ["the wrong secret", signedRequest(JSON.stringify(lead), "other")],
    ["an old request", signedRequest(JSON.stringify(lead), "secret", timestamp - 301)],
    [
      "no signature",
      new Request("http://localhost/", { method: "POST", body: "{}" }),
    ],
  ])("refuses %s without touching the database", async (_name, request) => {
    const client = clientReturning([]);
    const response = await handleIngestRequest(request, deps(client));
    expect(response.status).toBe(401);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    const client = clientReturning([]);
    const bad = await handleIngestRequest(signedRequest("not json"), deps(client));
    expect(bad.status).toBe(400);
    const invalid = await handleIngestRequest(
      signedRequest(JSON.stringify({ ...lead, status: "won" })),
      deps(client),
    );
    expect(invalid.status).toBe(422);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not leak database errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleIngestRequest(
      signedRequest(JSON.stringify(lead)),
      deps(clientReturning(null, "secret table details")),
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret table");
    log.mockRestore();
  });

  it("refuses to run when it is not configured", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleIngestRequest(signedRequest("{}"), {
      ...deps(clientReturning([])),
      secret: undefined,
    });
    expect(response.status).toBe(500);
    log.mockRestore();
  });

  it("removes tracking from URLs", () => {
    expect(canonicalUrl("https://x.test/?fbclid=1")).toBe("https://x.test/");
    expect(canonicalUrl(null)).toBeNull();
  });
});

describe("n8n workflow files", () => {
  const load = (name: string) =>
    JSON.parse(readFileSync(`n8n/workflows/${name}`, "utf8"));

  it("the ingest workflow's code produces a lead the API accepts", () => {
    const workflow = load("ingest-test-lead.json");
    const code = workflow.nodes.find(
      (node: { name: string }) => node.name === "Build test lead",
    ).parameters.jsCode;
    const [item] = new Function(code)();
    expect(leadIngestSchema.safeParse(JSON.parse(item.json.rawBody)).success).toBe(true);
    expect(item.json.signingInput).toBe(`${item.json.timestamp}.${item.json.rawBody}`);
  });

  it.each(["ingest-test-lead.json", "telegram-connection-test.json"])(
    "%s connects every node and holds no secrets",
    (name) => {
      const workflow = load(name);
      const names = workflow.nodes.map((node: { name: string }) => node.name);
      const linked = new Set<string>([names[0]]);
      for (const output of Object.values<{ main: { node: string }[][] }>(workflow.connections)) {
        for (const target of output.main.flat()) linked.add(target.node);
      }
      expect([...linked].sort()).toEqual([...names].sort());
      for (const node of workflow.nodes) {
        expect(JSON.stringify(node.credentials ?? {})).not.toContain('"id"');
      }
      expect(JSON.stringify(workflow)).not.toMatch(/sb_secret|hmacSecret|bot\d+:/);
    },
  );
});

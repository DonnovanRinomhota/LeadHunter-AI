import { leadIngestSchema } from "@/contracts/ingest";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRequest,
} from "@/contracts/internal-auth";
import { ingestLead, type IngestRpcClient } from "./ingest";

const MAX_BODY_BYTES = 200_000;

export type IngestDependencies = {
  secret: string | undefined;
  workspaceId: string | undefined;
  getClient: () => IngestRpcClient;
  now: () => Date;
};

const reply = (status: number, body: unknown) =>
  Response.json(body, { status });

export async function handleIngestRequest(
  request: Request,
  deps: IngestDependencies,
): Promise<Response> {
  if (!deps.secret || !deps.workspaceId) {
    console.error("Lead ingest is not configured");
    return reply(500, { error: "Server is not configured" });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return reply(413, { error: "Request is too large" });
  }

  const verified = verifyRequest({
    secret: deps.secret,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
    rawBody,
    now: deps.now(),
  });
  if (!verified) return reply(401, { error: "Invalid signature" });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return reply(400, { error: "Body must be JSON" });
  }

  const parsed = leadIngestSchema.safeParse(body);
  if (!parsed.success) {
    return reply(422, {
      error: "Invalid lead",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const result = await ingestLead(
      deps.getClient(),
      deps.workspaceId,
      parsed.data,
    );
    return reply(result.outcome === "created" ? 201 : 200, result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Lead ingest failed");
    return reply(500, { error: "Lead could not be saved" });
  }
}

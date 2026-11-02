import { createHmac, timingSafeEqual } from "node:crypto";

// Signed requests between n8n and the app. Use a different secret for each direction.
// Signature: lowercase hex HMAC-SHA256 of "<unix seconds>.<raw body>".
export const TIMESTAMP_HEADER = "x-leadhunter-timestamp";
export const SIGNATURE_HEADER = "x-leadhunter-signature";
export const MAX_CLOCK_SKEW_SECONDS = 300;

export function signRequest(
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export function verifyRequest(args: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now: Date;
}): boolean {
  const { secret, timestamp, signature, rawBody, now } = args;
  if (!secret || !timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return false;
  }
  const seconds = Number(timestamp);
  if (Math.abs(now.getTime() / 1000 - seconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }
  const expected = Buffer.from(signRequest(secret, seconds, rawBody));
  const received = Buffer.from(signature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

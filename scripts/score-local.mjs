// Scores queued leads on your local app, without n8n or the tunnel.
// Usage: npm run dev:score
import { createHmac } from "node:crypto";

const secret = process.env.N8N_TO_APP_SECRET;
if (!secret) {
  console.error("N8N_TO_APP_SECRET must be in .env.local.");
  process.exit(1);
}

const body = JSON.stringify({ limit: 5 });
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

const response = await fetch("http://localhost:3000/api/internal/qualify", {
  method: "POST",
  body,
  headers: {
    "content-type": "application/json",
    "x-leadhunter-timestamp": String(timestamp),
    "x-leadhunter-signature": signature,
  },
});
console.log(response.status, JSON.stringify(await response.json(), null, 2));

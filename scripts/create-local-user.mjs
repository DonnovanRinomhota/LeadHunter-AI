// Creates a sign-in for the LOCAL database and makes it an owner of the seeded workspace.
// Usage: npm run dev:user -- you@example.com
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";
const workspaceId = process.env.LEADHUNTER_WORKSPACE_ID ?? "";
const email = process.argv[2];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!email) fail("Add your email: npm run dev:user -- you@example.com");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  fail("This script only runs against a local database.");
}
if (!key || !workspaceId) {
  fail("SUPABASE_SECRET_KEY and LEADHUNTER_WORKSPACE_ID must be in .env.local.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = randomBytes(18).toString("base64url");

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError) fail(`Could not create the user: ${createError.message}`);

const { error: memberError } = await supabase
  .from("workspace_members")
  .insert({ workspace_id: workspaceId, user_id: created.user.id, role: "owner" });
if (memberError) fail(`Could not add the user: ${memberError.message}`);

console.log(`Created ${email} as an owner of the local workspace.`);
console.log(`Password: ${password}`);

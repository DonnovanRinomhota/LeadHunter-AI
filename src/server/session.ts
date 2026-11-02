import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// Acts as the signed-in person, so row level security applies to every query.
export async function createSessionClient() {
  // Read cookies first so a build, which has no settings, treats this as request-time work.
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase browser settings are missing");

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Pages cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}

export type Member = {
  userId: string;
  email: string;
  workspaceId: string;
  role: "owner" | "admin" | "member";
};

export const getCurrentMember = cache(async (): Promise<Member> => {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) redirect("/no-access");

  return {
    userId: user.id,
    email: user.email ?? "",
    workspaceId: data.workspace_id,
    role: data.role,
  };
});

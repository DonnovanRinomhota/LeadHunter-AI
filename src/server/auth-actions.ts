"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "./session";

export type SignInState = { message?: string; email?: string };

export async function signIn(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return { email, message: "Enter your email and password." };
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 400) {
      return { email, message: "That email or password is incorrect." };
    }
    console.error(`Sign-in failed: ${error.message}`);
    return { email, message: "Sign-in isn't available right now. Try again in a moment." };
  }
  redirect("/leads");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

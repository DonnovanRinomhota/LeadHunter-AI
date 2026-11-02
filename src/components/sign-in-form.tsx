"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/server/auth-actions";

const initial: SignInState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message ? (
        <p role="alert" className="rounded-sm bg-alert-wash p-3 text-alert">
          {state.message}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 font-semibold">
        Email
        <input
          className="field font-normal"
          type="email"
          name="email"
          autoComplete="username"
          defaultValue={state.email}
          required
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Password
        <input
          className="field font-normal"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="button mt-2 self-start" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}

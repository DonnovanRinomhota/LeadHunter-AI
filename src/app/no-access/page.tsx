import type { Metadata } from "next";
import { signOut } from "@/server/auth-actions";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl">Your account isn&apos;t in a workspace</h1>
      <p>Ask a workspace owner to add you, then sign in again.</p>
      <form action={signOut}>
        <button className="button-quiet">Sign out</button>
      </form>
    </main>
  );
}

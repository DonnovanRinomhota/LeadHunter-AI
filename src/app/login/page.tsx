import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <section className="bg-msasa px-4 py-10 text-msasa-ink md:flex md:w-1/2 md:flex-col md:justify-end md:p-12">
        <h1 className="text-5xl md:text-7xl">LeadHunter AI</h1>
        <p className="mt-3 max-w-md text-lg">
          Find the firms that need help, see why they fit, and decide who to
          contact.
        </p>
      </section>
      <section className="flex flex-1 flex-col justify-center px-4 py-10 md:px-12">
        <div className="w-full max-w-sm">
          <h2 className="mb-6 text-2xl">Sign in</h2>
          <SignInForm />
          <p className="mt-6 text-muted">
            Access is by invitation. Ask a workspace owner if you need an
            account.
          </p>
        </div>
      </section>
    </main>
  );
}

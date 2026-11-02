import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/server/auth-actions";
import { getCurrentMember } from "@/server/session";

async function CurrentUser() {
  const member = await getCurrentMember();
  return <span className="max-w-48 truncate md:max-w-64">{member.email}</span>;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="bg-msasa text-msasa-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/leads" className="font-display text-xl font-semibold">
            LeadHunter AI
          </Link>
          <nav aria-label="Main" className="flex gap-4">
            <Link href="/leads" className="underline-offset-4 hover:underline">
              Leads
            </Link>
            <Link href="/drafts" className="underline-offset-4 hover:underline">
              Drafts
            </Link>
            <Link href="/leads/new" className="underline-offset-4 hover:underline">
              Add a lead
            </Link>
            <Link href="/leads/import" className="underline-offset-4 hover:underline">
              Import a CSV
            </Link>
          </nav>
          <div className="flex items-center gap-4 sm:ml-auto">
            <Suspense fallback={null}>
              <CurrentUser />
            </Suspense>
            <form action={signOut}>
              <button className="cursor-pointer underline underline-offset-4">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}

import type { Metadata } from "next";
import { safeAuth } from "@/lib/auth";
import { signInAction, signOutAction } from "@/lib/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto-Apply Job Portal",
  description:
    "Set up your profile once — the portal applies to matching jobs for you.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await safeAuth();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="text-lg font-bold tracking-tight">
              ⚡ Auto-Apply <span className="text-indigo-600">Job Portal</span>
            </a>
            <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="/jobs" className="hover:text-indigo-600">
                Jobs
              </a>
              <a href="/profile" className="hover:text-indigo-600">
                My Profile
              </a>
              <a href="/applications" className="hover:text-indigo-600">
                My Applications
              </a>
              {session ? (
                <form action={signOutAction} className="flex items-center gap-2">
                  <span className="hidden text-slate-500 sm:inline">
                    Hi, {firstName ?? "there"}
                  </span>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:border-indigo-400"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <form action={signInAction}>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Sign in
                  </button>
                </form>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
        <footer className="mt-16 border-t border-slate-200 py-8 text-center text-xs text-slate-400">
          Auto-Apply Job Portal
        </footer>
      </body>
    </html>
  );
}

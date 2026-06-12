import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/user";
import { demoActive } from "@/lib/demo";
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
  const user = await getCurrentUser();
  const firstName = user?.name.split(" ")[0];

  return (
    <html lang="en">
      <body>
        {demoActive && (
          <div className="bg-amber-400/90 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
            🧪 Demo preview — sample data, nothing is saved permanently. The
            full setup later switches on real sign-in, real AI and your Google
            Sheet database.
          </div>
        )}
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
              {user ? (
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
                    {demoActive ? "Try the demo" : "Sign in"}
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

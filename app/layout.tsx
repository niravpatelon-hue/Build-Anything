import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto-Apply Job Portal",
  description:
    "Set up your profile once — the portal applies to matching jobs for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="text-lg font-bold tracking-tight">
              ⚡ Auto-Apply <span className="text-indigo-600">Job Portal</span>
            </a>
            <nav className="flex gap-6 text-sm font-medium text-slate-600">
              <a href="/jobs" className="hover:text-indigo-600">
                Jobs
              </a>
              <a href="/profile" className="hover:text-indigo-600">
                My Profile
              </a>
              <a href="/applications" className="hover:text-indigo-600">
                My Applications
              </a>
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

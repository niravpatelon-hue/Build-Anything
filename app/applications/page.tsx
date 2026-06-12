import { listApplicationsForEmail } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import { Flash, SetupNotice } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const email = sp.email?.trim() ?? "";

  let applications: Row[] | null = null;
  let notConfigured = false;
  if (email) {
    try {
      applications = await listApplicationsForEmail(email);
    } catch (err) {
      if (err instanceof NotConfiguredError) notConfigured = true;
      else throw err;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Flash searchParams={sp} />
      <h1 className="text-2xl font-bold">My applications</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your email to see every application — including the ones
        auto-apply filed for you.
      </p>

      <form method="get" className="mt-4 flex gap-2">
        <input
          type="email"
          name="email"
          required
          defaultValue={email}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Show
        </button>
      </form>

      <div className="mt-6">
        {notConfigured && <SetupNotice />}
        {applications && applications.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No applications yet for {email}. Turn on auto-apply in your profile
            and they'll start appearing here.
          </p>
        )}
        {applications && applications.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">How</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium">{a.job_title}</td>
                    <td className="px-4 py-3 text-slate-600">{a.company}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.auto === "yes" ? "⚡ auto" : "manual"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.applied_at ? a.applied_at.slice(0, 10) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

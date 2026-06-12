import { signInAction } from "@/lib/actions";
import { listApplicationsForEmail } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import { demoActive, demoApplications, readDemoState } from "@/lib/demo";
import { getCurrentUser } from "@/lib/user";
import { Flash, SetupNotice } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const email = user?.email ?? "";

  let applications: Row[] | null = null;
  let notConfigured = false;
  if (user) {
    if (user.demo) {
      applications = demoApplications(await readDemoState());
    } else {
      try {
        applications = await listApplicationsForEmail(email);
      } catch (err) {
        if (err instanceof NotConfiguredError) notConfigured = true;
        else throw err;
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Flash searchParams={sp} />
      <h1 className="text-2xl font-bold">My applications</h1>
      <p className="mt-2 text-sm text-slate-600">
        Every application in one place — including the ones auto-apply filed
        for you.
      </p>

      {!email && (
        <form action={signInAction} className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            {demoActive
              ? "🧪 Try the demo to see applications"
              : "Sign in with Google to see your applications"}
          </button>
        </form>
      )}

      <div className="mt-6">
        {notConfigured && <SetupNotice />}
        {applications && applications.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No applications yet. Turn on auto-apply in your profile and
            they&apos;ll start appearing here.
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

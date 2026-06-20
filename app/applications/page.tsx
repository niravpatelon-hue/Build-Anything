import { signInAction, submitAllReadyAction } from "@/lib/actions";
import { listApplicationsForEmail } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import { demoActive, demoApplications, readDemoState } from "@/lib/demo";
import { getCurrentUser } from "@/lib/user";
import { Flash, SetupNotice } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGE_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  "in review": "bg-blue-100 text-blue-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  closed: "bg-slate-100 text-slate-500",
};

const STAGE_LABELS: Record<string, string> = {
  draft: "draft",
  ready: "ready to apply",
};

function cta(status: string): string {
  if (status === "draft") return "Prepare ▸";
  if (status === "ready") return "Review & apply ▸";
  return "Track ▸";
}

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

  const readyCount =
    applications?.filter((a) => a.status === "ready").length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Flash searchParams={sp} />
      <h1 className="text-2xl font-bold">My applications</h1>
      <p className="mt-2 text-sm text-slate-600">
        Prepare each one — fit check, then a tailored resume and cover letter —
        and apply when it&apos;s ready. Everything is tracked here in one place.
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

      {readyCount > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">
              {readyCount} application{readyCount === 1 ? "" : "s"} ready to
              apply
            </span>{" "}
            — curated and waiting.
          </p>
          <form action={submitAllReadyAction}>
            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              ⚡ Apply to all {readyCount} ready
            </button>
          </form>
        </div>
      )}

      <div className="mt-6">
        {notConfigured && <SetupNotice />}
        {applications && applications.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No applications yet. Find a job and hit{" "}
            <span className="font-medium">Prepare</span> — or turn on
            auto-prepare in your profile and matching jobs will queue here as
            drafts.
          </p>
        )}
        {applications && applications.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">How</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium">
                      {a.apply_link ? (
                        <a
                          href={a.apply_link}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {a.job_title} ↗
                        </a>
                      ) : (
                        a.job_title
                      )}
                      {a.source && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                          {a.source}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.company}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          STAGE_STYLES[a.status] ?? "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {STAGE_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.auto === "yes" ? "⚡ auto" : "manual"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.applied_at ? a.applied_at.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/applications/prepare?id=${a.id}`}
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        {cta(a.status)}
                      </a>
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

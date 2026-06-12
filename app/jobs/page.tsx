import { applyAction, postJobAction } from "@/lib/actions";
import { listOpenJobs } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import { safeAuth } from "@/lib/auth";
import { Flash, SetupNotice } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await safeAuth();

  let jobs: Row[] | null = null;
  let notConfigured = false;
  try {
    jobs = await listOpenJobs();
  } catch (err) {
    if (err instanceof NotConfiguredError) notConfigured = true;
    else throw err;
  }

  return (
    <div>
      <Flash searchParams={sp} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Open jobs</h1>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-6 py-4 font-semibold text-indigo-600">
          ＋ Post a job
        </summary>
        <form action={postJobAction} className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
          <input name="title" required placeholder="Job title *" className={inputClass} />
          <input name="company" required placeholder="Company *" className={inputClass} />
          <input name="location" placeholder="Location (e.g. Remote, London)" className={inputClass} />
          <input name="salary" placeholder="Salary (e.g. £45,000)" className={inputClass} />
          <textarea
            name="description"
            rows={4}
            placeholder="Description — skills mentioned here are used for auto-apply matching"
            className={`${inputClass} sm:col-span-2`}
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 sm:col-span-2"
          >
            Post job
          </button>
        </form>
      </details>

      <div className="mt-6 space-y-4">
        {notConfigured && <SetupNotice />}
        {jobs && jobs.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No open jobs yet — post the first one above.
          </p>
        )}
        {jobs?.map((job) => (
          <div
            key={job.id}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{job.title}</h2>
              {job.salary && (
                <span className="text-sm font-medium text-green-700">
                  {job.salary}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {job.company}
              {job.location ? ` · ${job.location}` : ""}
            </p>
            {job.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">
                {job.description}
              </p>
            )}
            {session?.user?.email ? (
              <form action={applyAction} className="mt-4">
                <input type="hidden" name="job_id" value={job.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Apply with my profile
                </button>
              </form>
            ) : (
              <a
                href="/profile"
                className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400"
              >
                Sign in to apply
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

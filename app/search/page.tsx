import { applyExternalAction, autoApplySearchAction } from "@/lib/actions";
import { getProfileByEmail, matches } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import {
  demoSearchJobs,
  searchJobs,
  SearchNotConfiguredError,
  type SearchResult,
} from "@/lib/jobsearch";
import { demoActive, demoGetProfile, readDemoState } from "@/lib/demo";
import { getCurrentUser } from "@/lib/user";
import { Flash } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  let profile: Row | null = null;
  if (user) {
    if (user.demo) {
      profile = demoGetProfile(await readDemoState());
    } else {
      try {
        profile = await getProfileByEmail(user.email);
      } catch (err) {
        if (!(err instanceof NotConfiguredError)) throw err;
      }
    }
  }

  const q = sp.q?.trim() ?? profile?.preferred_titles?.split(",")[0]?.trim() ?? "";
  const loc =
    sp.loc?.trim() ?? profile?.preferred_locations?.split(",")[0]?.trim() ?? "";
  const searched = sp.q !== undefined;

  let results: SearchResult[] | null = null;
  let searchNotConfigured = false;
  let searchError = "";
  if (searched && q) {
    try {
      results = demoActive ? demoSearchJobs(q, loc) : await searchJobs(q, loc);
    } catch (err) {
      if (err instanceof SearchNotConfiguredError) searchNotConfigured = true;
      else if (err instanceof Error) searchError = err.message;
      else throw err;
    }
  }

  const matchedIds = new Set(
    profile && results
      ? results.filter((r) => matches(profile, r)).map((r) => r.external_id)
      : []
  );

  return (
    <div>
      <Flash searchParams={sp} />
      <h1 className="text-2xl font-bold">Find jobs</h1>
      <p className="mt-2 text-sm text-slate-600">
        Searches listings from across the web — LinkedIn, Indeed, Glassdoor,
        company career pages and more.
        {demoActive && " (Demo: sample results.)"}
      </p>

      <form method="get" className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          name="q"
          required
          defaultValue={q}
          placeholder="Job title — e.g. data analyst"
          className={inputClass}
        />
        <input
          name="loc"
          defaultValue={loc}
          placeholder="Location — e.g. London, or remote"
          className={inputClass}
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      {searchNotConfigured && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h2 className="font-semibold">⚙️ Job search isn&apos;t connected yet</h2>
          <p className="mt-2 text-sm">
            Real internet-wide search needs one free key (RAPIDAPI_KEY) added
            in Vercel — it&apos;s part of the full setup, and I&apos;ll walk you
            through it when we get there.
          </p>
        </div>
      )}
      {searchError && (
        <p className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchError}
        </p>
      )}

      {results && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              {results.length} job{results.length === 1 ? "" : "s"} found
              {q ? ` for “${q}”` : ""}
              {loc ? ` near “${loc}”` : ""}
            </h2>
            {user && profile && matchedIds.size > 0 && (
              <form action={autoApplySearchAction}>
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="loc" value={loc} />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  ⚡ Auto-apply to all {matchedIds.size} matching
                </button>
              </form>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {results.map((job) => (
              <div
                key={job.external_id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    {job.title}
                    {matchedIds.has(job.external_id) && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        ⚡ matches you
                      </span>
                    )}
                  </h3>
                  {job.salary && (
                    <span className="text-sm font-medium text-green-700">
                      {job.salary}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {job.company}
                  {job.location ? ` · ${job.location}` : ""}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    via {job.source}
                  </span>
                  {job.posted && (
                    <span className="ml-2 text-xs text-slate-400">
                      posted {job.posted}
                    </span>
                  )}
                </p>
                {job.description && (
                  <p className="mt-3 text-sm text-slate-700">
                    {job.description}
                    {job.description.length >= 400 ? "…" : ""}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {user ? (
                    <form action={applyExternalAction}>
                      <input type="hidden" name="q" value={q} />
                      <input type="hidden" name="loc" value={loc} />
                      <input
                        type="hidden"
                        name="job"
                        value={JSON.stringify(job)}
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                      >
                        Apply &amp; track
                      </button>
                    </form>
                  ) : (
                    <a
                      href="/profile"
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400"
                    >
                      Sign in to apply
                    </a>
                  )}
                  {job.apply_link && (
                    <a
                      href={job.apply_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      View original posting ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searched && (
        <p className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {profile?.preferred_titles
            ? "Your search is pre-filled from your profile — hit Search to see what's out there."
            : "Tip: set up your profile first and your preferences will pre-fill this search."}
        </p>
      )}
    </div>
  );
}

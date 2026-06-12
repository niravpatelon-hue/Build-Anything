import {
  analyzeApplicationAction,
  generateDocsAction,
  signInAction,
  updateStatusAction,
} from "@/lib/actions";
import { getApplicationForEmail } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import {
  demoAnalysis,
  demoFindApp,
  demoFindJob,
  demoTailoredDocs,
  readDemoState,
} from "@/lib/demo";
import { getCurrentUser } from "@/lib/user";
import { Flash, SetupNotice } from "@/components/notices";
import type { Analysis } from "@/lib/ai";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES = [
  "submitted",
  "in review",
  "interview",
  "offer",
  "rejected",
  "closed",
];

function parseAnalysis(json: string | undefined): Analysis | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Analysis;
  } catch {
    return null;
  }
}

export default async function PreparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const id = sp.id ?? "";
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Prepare application</h1>
        <form action={signInAction} className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Sign in first
          </button>
        </form>
      </div>
    );
  }

  let app: Record<string, string | undefined> | null = null;
  let job: Row | null = null;
  let demoDocs: { tailored_resume: string; cover_letter: string } | null = null;
  let notConfigured = false;

  if (user.demo) {
    const state = await readDemoState();
    const found = demoFindApp(state, id);
    if (found) {
      job = demoFindJob(state, found.job_id);
      app = {
        ...found,
        source: job?.source ?? "",
        apply_link: job?.apply_link ?? "",
      };
      if (found.docs === "1") {
        demoDocs = demoTailoredDocs(
          state.profile?.name || "Alex Morgan",
          found.job_title,
          found.company
        );
      }
    }
  } else {
    try {
      const found = await getApplicationForEmail(user.email, id);
      if (found) {
        app = found.app;
        job = found.job;
      }
    } catch (err) {
      if (err instanceof NotConfiguredError) notConfigured = true;
      else throw err;
    }
  }

  if (notConfigured) {
    return (
      <div className="mx-auto max-w-2xl">
        <SetupNotice />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Application not found</h1>
        <a
          href="/applications"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Back to my applications
        </a>
      </div>
    );
  }

  const analysis = user.demo
    ? app.analysis
      ? (demoAnalysis(app.job_title ?? "", app.company ?? "") as Analysis)
      : null
    : parseAnalysis(app.analysis);
  const docsReady = user.demo
    ? app.docs === "1"
    : Boolean(app.tailored_resume_link || app.cover_letter_link);

  return (
    <div className="mx-auto max-w-3xl">
      <a
        href="/applications"
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        ← My applications
      </a>
      <Flash searchParams={sp} />

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{app.job_title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {app.company}
              {job?.location ? ` · ${job.location}` : ""}
              {app.source && (
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  via {app.source}
                </span>
              )}
            </p>
          </div>
          <form action={updateStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <select
              name="status"
              defaultValue={app.status}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:border-indigo-400"
            >
              Update
            </button>
          </form>
        </div>
        {job?.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-slate-700">
            {job.description}
          </p>
        )}
        {app.apply_link && (
          <a
            href={app.apply_link}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            View original posting ↗
          </a>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Step 1 — Check the fit 🔍</h2>
        <p className="mt-1 text-sm text-slate-600">
          The AI compares your profile with this job and suggests the exact
          resume edits worth making.
        </p>
        {analysis ? (
          <div className="mt-4 space-y-4">
            <p>
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-bold text-white">
                {analysis.match_score}/100 match
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-green-700">
                  Strengths
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {analysis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-700">Gaps</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {analysis.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Suggested fixes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.fixes.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <form action={analyzeApplicationAction}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Re-run the check
              </button>
            </form>
          </div>
        ) : (
          <form action={analyzeApplicationAction} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              🔍 Check my resume against this job
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">
          Step 2 — Tailored resume &amp; cover letter ✍️
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          One click applies the fixes: a job-specific resume and a
          ready-to-send cover letter{user.demo ? "." : ", saved as Google Docs in your Drive."}
        </p>
        {!docsReady && (
          <form action={generateDocsAction} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={!analysis}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              ✍️ Apply the fixes &amp; write my documents
            </button>
            {!analysis && (
              <p className="mt-2 text-xs text-slate-500">
                Run the fit check first.
              </p>
            )}
          </form>
        )}
        {docsReady && !user.demo && (
          <div className="mt-4 flex flex-wrap gap-3">
            {app.tailored_resume_link && (
              <a
                href={app.tailored_resume_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                📄 Open tailored resume
              </a>
            )}
            {app.cover_letter_link && (
              <a
                href={app.cover_letter_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                💌 Open cover letter
              </a>
            )}
            <form action={generateDocsAction}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-indigo-400"
              >
                Regenerate
              </button>
            </form>
          </div>
        )}
        {docsReady && user.demo && demoDocs && (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg bg-indigo-50 px-4 py-2 text-xs text-indigo-700">
              Sample documents — in the real version these are written by AI
              for your actual resume and saved as Google Docs in your Drive.
            </p>
            <div>
              <h3 className="text-sm font-semibold">📄 Tailored resume</h3>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
                {demoDocs.tailored_resume}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold">💌 Cover letter</h3>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
                {demoDocs.cover_letter}
              </pre>
            </div>
          </div>
        )}
      </div>

      {docsReady && app.apply_link && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-6">
          <h2 className="font-semibold text-green-900">
            Step 3 — Submit it 🚀
          </h2>
          <p className="mt-1 text-sm text-green-800">
            Your documents are ready. Open the posting, attach them, and update
            the status here once it&apos;s sent.
          </p>
          <a
            href={app.apply_link}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            Open the application page ↗
          </a>
        </div>
      )}
    </div>
  );
}

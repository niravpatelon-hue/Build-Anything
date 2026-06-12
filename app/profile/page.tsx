import { saveProfileAction } from "@/lib/actions";
import { getProfileByEmail } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import { Flash, SetupNotice } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const email = sp.email?.trim() ?? "";

  let profile: Row | null = null;
  let notConfigured = false;
  if (email) {
    try {
      profile = await getProfileByEmail(email);
    } catch (err) {
      if (err instanceof NotConfiguredError) notConfigured = true;
      else throw err;
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Flash searchParams={sp} />
      <h1 className="text-2xl font-bold">My profile</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your email to load your profile — or to start a new one.
      </p>

      <form method="get" className="mt-4 flex gap-2">
        <input
          type="email"
          name="email"
          required
          defaultValue={email}
          placeholder="you@example.com"
          className={inputClass}
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Load
        </button>
      </form>

      {notConfigured && (
        <div className="mt-6">
          <SetupNotice />
        </div>
      )}

      {email && !notConfigured && (
        <form
          action={saveProfileAction}
          className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-semibold">
            {profile ? "Update your profile" : "Create your profile"}
          </h2>
          <input type="hidden" name="email" value={email} />
          <label className="block text-sm">
            <span className="font-medium">Full name *</span>
            <input
              name="name"
              required
              defaultValue={profile?.name ?? ""}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Skills</span>
            <input
              name="skills"
              defaultValue={profile?.skills ?? ""}
              placeholder="e.g. excel, project management, react"
              className={`${inputClass} mt-1`}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Separate with commas — used to match you to jobs.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Preferred job titles</span>
            <input
              name="preferred_titles"
              defaultValue={profile?.preferred_titles ?? ""}
              placeholder="e.g. analyst, consultant"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Preferred locations</span>
            <input
              name="preferred_locations"
              defaultValue={profile?.preferred_locations ?? ""}
              placeholder="e.g. remote, london — leave empty for anywhere"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Resume (PDF, max 4 MB)</span>
            <input
              type="file"
              name="resume"
              accept=".pdf,.doc,.docx"
              className="mt-1 block w-full text-sm"
            />
            {profile?.resume_link && (
              <a
                href={profile.resume_link}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs text-indigo-600 underline"
              >
                Current resume on file — uploading a new one replaces it
              </a>
            )}
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
            <input
              type="checkbox"
              name="auto_apply"
              defaultChecked={profile ? profile.auto_apply === "yes" : true}
              className="h-4 w-4"
            />
            <span>
              <span className="font-semibold">⚡ Auto-apply is on</span> — apply
              me automatically to every new job that matches my skills, titles
              and locations.
            </span>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            Save profile
          </button>
        </form>
      )}
    </div>
  );
}

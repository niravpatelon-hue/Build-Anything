import {
  saveProfileAction,
  signInAction,
  uploadResumeAction,
} from "@/lib/actions";
import { getProfileByEmail } from "@/lib/data";
import { NotConfiguredError } from "@/lib/google";
import { authConfigured, safeAuth } from "@/lib/auth";
import { Flash, SetupNotice } from "@/components/notices";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

function safeParse(json: string): Record<string, string>[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await safeAuth();
  const email = session?.user?.email ?? "";

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

  const experience = profile ? safeParse(profile.experience ?? "") : [];
  const education = profile ? safeParse(profile.education ?? "") : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Flash searchParams={sp} />
      <h1 className="text-2xl font-bold">My profile</h1>

      {!email && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold">
            Sign in to build your profile
          </p>
          <p className="mt-2 text-sm text-slate-600">
            One click with Google — then upload your resume and the AI fills
            everything in for you.
          </p>
          <form action={signInAction} className="mt-6">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
            >
              Sign in with Google
            </button>
          </form>
          {!authConfigured && (
            <p className="mt-4 text-xs text-amber-700">
              ⚙️ Sign-in isn&apos;t configured yet — the Google login keys
              still need to be added in Vercel.
            </p>
          )}
        </div>
      )}

      {email && notConfigured && (
        <div className="mt-6">
          <SetupNotice />
        </div>
      )}

      {email && !notConfigured && (
        <>
          <form
            action={uploadResumeAction}
            className="mt-6 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-6"
          >
            <h2 className="font-semibold">
              ⚡ Upload your resume — the AI builds your profile
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              PDF, DOCX or TXT, up to 4 MB. It&apos;s stored safely in your
              Drive and read once to fill in everything below.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                name="resume"
                required
                accept=".pdf,.docx,.txt"
                className="text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Read my resume
              </button>
            </div>
            {profile?.resume_link && (
              <a
                href={profile.resume_link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-xs text-indigo-600 underline"
              >
                Current resume on file — uploading a new one replaces it
              </a>
            )}
          </form>

          <form
            action={saveProfileAction}
            className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">
                {profile ? "Your profile" : "Or fill it in by hand"}
              </h2>
              <span className="text-xs text-slate-500">{email}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Full name *</span>
                <input
                  name="name"
                  required
                  defaultValue={profile?.name ?? session?.user?.name ?? ""}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Headline</span>
                <input
                  name="headline"
                  defaultValue={profile?.headline ?? ""}
                  placeholder="e.g. Senior Data Analyst"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Phone</span>
                <input
                  name="phone"
                  defaultValue={profile?.phone ?? ""}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Location</span>
                <input
                  name="location"
                  defaultValue={profile?.location ?? ""}
                  placeholder="e.g. London, UK"
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Summary</span>
              <textarea
                name="summary"
                rows={3}
                defaultValue={profile?.summary ?? ""}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Skills</span>
              <input
                name="skills"
                defaultValue={profile?.skills ?? ""}
                placeholder="e.g. excel, sql, project management"
                className={`${inputClass} mt-1`}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Comma-separated — used to match you to jobs.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Job titles to search for</span>
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
                  placeholder="e.g. remote, london — empty = anywhere"
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
              <input
                type="checkbox"
                name="auto_apply"
                defaultChecked={profile ? profile.auto_apply === "yes" : true}
                className="h-4 w-4"
              />
              <span>
                <span className="font-semibold">⚡ Auto-apply is on</span> —
                apply me automatically to every new job that matches.
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
            >
              Save profile
            </button>
          </form>

          {(experience.length > 0 || education.length > 0) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {experience.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold">Experience</h3>
                  <ul className="mt-3 space-y-3 text-sm">
                    {experience.map((e, i) => (
                      <li key={i}>
                        <p className="font-medium">
                          {e.title}
                          {e.company ? ` · ${e.company}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">{e.period}</p>
                        {e.description && (
                          <p className="mt-1 text-slate-600">{e.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {education.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold">Education</h3>
                  <ul className="mt-3 space-y-3 text-sm">
                    {education.map((e, i) => (
                      <li key={i}>
                        <p className="font-medium">{e.degree}</p>
                        <p className="text-xs text-slate-500">
                          {e.school}
                          {e.year ? ` · ${e.year}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

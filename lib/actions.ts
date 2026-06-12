"use server";

import { Readable } from "node:stream";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getGoogleClients, NotConfiguredError } from "./google";
import { getInfra } from "./db";
import {
  applyManually,
  applyToExternalJob,
  autoApplyToSearchResults,
  getApplicationForEmail,
  getProfileByEmail,
  postJob,
  saveProfile,
  updateApplication,
} from "./data";
import {
  AINotConfiguredError,
  analyzeFit,
  parseResume,
  tailorDocuments,
} from "./ai";
import { createGoogleDoc } from "./gdocs";
import { authConfigured, signIn, signOut } from "./auth";
import {
  demoSearchJobs,
  searchJobs,
  SearchNotConfiguredError,
  type SearchResult,
} from "./jobsearch";
import {
  DEMO_PARSED,
  demoActive,
  demoAnalysis,
  demoApply,
  demoApplyExternal,
  demoAutoApplySearch,
  demoFindApp,
  demoPostJob,
  demoSaveProfile,
  demoSetAppAnalysis,
  demoSetAppDocs,
  demoSetAppStatus,
  readDemoState,
  writeDemoState,
} from "./demo";
import { DEMO_SESSION_COOKIE, getCurrentUser, type CurrentUser } from "./user";

const MAX_RESUME_BYTES = 4 * 1024 * 1024; // Vercel request body limit is 4.5 MB

function friendlyError(err: unknown): string {
  if (err instanceof NotConfiguredError) {
    return "The database isn't connected yet — add the three Google credentials in Vercel, redeploy, then try again.";
  }
  if (err instanceof AINotConfiguredError) {
    return "The AI isn't connected yet — add ANTHROPIC_API_KEY in Vercel, redeploy, then try again.";
  }
  if (err instanceof SearchNotConfiguredError) {
    return "Job search isn't connected yet — add RAPIDAPI_KEY in Vercel, redeploy, then try again.";
  }
  if (err instanceof Error && err.message.length < 200) {
    return err.message;
  }
  return "Something went wrong — please try again.";
}

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function signInAction(): Promise<void> {
  if (demoActive) {
    const jar = await cookies();
    jar.set(DEMO_SESSION_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
    });
    redirect("/profile?demo=1");
  }
  if (!authConfigured) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "Sign-in isn't set up yet — add AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in Vercel first."
      )}`
    );
  }
  await signIn("google", { redirectTo: "/profile" });
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  if (jar.get(DEMO_SESSION_COOKIE)) {
    jar.delete(DEMO_SESSION_COOKIE);
    jar.delete("demo-state");
    redirect("/");
  }
  await signOut({ redirectTo: "/" });
}

async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/profile?error=${encodeURIComponent(
        demoActive ? "Hit “Sign in” first to start the demo." : "Sign in with Google first."
      )}`
    );
  }
  return user!;
}

async function uploadResumeToDrive(file: File, email: string): Promise<string> {
  const { drive } = getGoogleClients();
  const { uploadsFolderId } = await getInfra();
  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await drive.files.create({
    requestBody: {
      name: `${email} — ${file.name}`,
      parents: [uploadsFolderId],
    },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "webViewLink",
  });
  return created.data.webViewLink ?? "";
}

/** Resume upload → Drive storage → Claude reads it → profile auto-filled. */
export async function uploadResumeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  let target: string;
  try {
    const resume = formData.get("resume");
    if (!(resume instanceof File) || resume.size === 0) {
      throw new Error("Choose a resume file first.");
    }
    if (resume.size > MAX_RESUME_BYTES) {
      throw new Error("Resume is too big — keep it under 4 MB.");
    }

    if (user.demo) {
      const state = await readDemoState();
      const autoApplied = demoSaveProfile(state, {
        name: DEMO_PARSED.name,
        phone: DEMO_PARSED.phone,
        location: DEMO_PARSED.location,
        headline: DEMO_PARSED.headline,
        summary: DEMO_PARSED.summary,
        skills: DEMO_PARSED.skills.join(", "),
        preferred_titles: DEMO_PARSED.suggested_titles.join(", "),
        preferred_locations: "london, remote",
      });
      await writeDemoState(state);
      target = `/profile?parsed=demo&auto=${autoApplied}`;
    } else {
      const buffer = Buffer.from(await resume.arrayBuffer());
      const [parsed, resumeLink] = await Promise.all([
        parseResume(buffer, resume.type, resume.name),
        uploadResumeToDrive(resume, user.email),
      ]);

      const { autoApplied } = await saveProfile({
        email: user.email,
        name: parsed.name || undefined,
        phone: parsed.phone,
        location: parsed.location,
        headline: parsed.headline,
        summary: parsed.summary,
        skills: parsed.skills.join(", "),
        preferred_titles: parsed.suggested_titles.join(", "),
        experience: JSON.stringify(parsed.experience),
        education: JSON.stringify(parsed.education),
        resume_link: resumeLink,
      });
      target = `/profile?parsed=1&auto=${autoApplied}`;
    }
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `/profile?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fields = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    headline: String(formData.get("headline") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    skills: String(formData.get("skills") ?? "").trim(),
    preferred_titles: String(formData.get("preferred_titles") ?? "").trim(),
    preferred_locations: String(
      formData.get("preferred_locations") ?? ""
    ).trim(),
  };
  const autoApply = formData.get("auto_apply") === "on";

  let target: string;
  try {
    if (user.demo) {
      const state = await readDemoState();
      const autoApplied = demoSaveProfile(state, {
        ...fields,
        auto_apply: autoApply ? "yes" : "no",
      });
      await writeDemoState(state);
      target = `/profile?saved=1&auto=${autoApplied}`;
    } else {
      const { autoApplied } = await saveProfile({
        email: user.email,
        ...fields,
        auto_apply: autoApply,
      });
      target = `/profile?saved=1&auto=${autoApplied}`;
    }
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `/profile?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function postJobAction(formData: FormData): Promise<void> {
  const job = {
    title: String(formData.get("title") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    salary: String(formData.get("salary") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
  };
  let target: string;
  try {
    if (demoActive) {
      const state = await readDemoState();
      const autoApplied = demoPostJob(state, job);
      await writeDemoState(state);
      target = `/jobs?posted=1&auto=${autoApplied}`;
    } else {
      const { autoApplied } = await postJob(job);
      target = `/jobs?posted=1&auto=${autoApplied}`;
    }
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `/jobs?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

/** Apply to one job found by the internet-wide search. */
export async function applyExternalAction(formData: FormData): Promise<void> {
  const q = String(formData.get("q") ?? "");
  const loc = String(formData.get("loc") ?? "");
  const back = `/search?q=${encodeURIComponent(q)}&loc=${encodeURIComponent(loc)}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `${back}&error=${encodeURIComponent(
        "Sign in first — your profile is what gets submitted."
      )}`
    );
  }

  let target: string;
  try {
    const job = JSON.parse(
      String(formData.get("job") ?? "{}")
    ) as SearchResult;
    if (!job.external_id) throw new Error("That job can't be applied to.");

    let result: { ok: boolean; message: string };
    if (user!.demo) {
      const state = await readDemoState();
      result = demoApplyExternal(state, job);
      await writeDemoState(state);
    } else {
      result = await applyToExternalJob(user!.email, job);
    }
    target = `${back}&${result.ok ? "applied" : "error"}=${encodeURIComponent(
      result.message
    )}`;
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `${back}&error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

/** Re-runs the search server-side and applies to everything that matches. */
export async function autoApplySearchAction(
  formData: FormData
): Promise<void> {
  const q = String(formData.get("q") ?? "");
  const loc = String(formData.get("loc") ?? "");
  const back = `/search?q=${encodeURIComponent(q)}&loc=${encodeURIComponent(loc)}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `${back}&error=${encodeURIComponent(
        "Sign in first — your profile is what gets submitted."
      )}`
    );
  }

  let target: string;
  try {
    if (user!.demo) {
      const state = await readDemoState();
      const results = demoSearchJobs(q, loc);
      const count = demoAutoApplySearch(state, results);
      await writeDemoState(state);
      target = `${back}&auto_done=${count}`;
    } else {
      const results = await searchJobs(q, loc);
      const count = await autoApplyToSearchResults(user!.email, results);
      target = `${back}&auto_done=${count}`;
    }
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `${back}&error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

const APP_STATUSES = [
  "submitted",
  "in review",
  "interview",
  "offer",
  "rejected",
  "closed",
];

/** AI fit check: profile vs job description, with suggested resume fixes. */
export async function analyzeApplicationAction(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const back = `/applications/prepare?id=${encodeURIComponent(id)}`;
  let target: string;
  try {
    if (user.demo) {
      const state = await readDemoState();
      if (!demoSetAppAnalysis(state, id)) {
        throw new Error("Application not found.");
      }
      await writeDemoState(state);
    } else {
      const found = await getApplicationForEmail(user.email, id);
      if (!found) throw new Error("Application not found.");
      const profile = await getProfileByEmail(user.email);
      if (!profile) throw new Error("Set up your profile first.");
      const job = found.job ?? {
        title: found.app.job_title,
        company: found.app.company,
        location: "",
        description: "",
      };
      const analysis = await analyzeFit(profile, job);
      await updateApplication(found.app, {
        analysis: JSON.stringify(analysis),
      });
    }
    target = `${back}&analyzed=1`;
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `${back}&error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

/** Applies the agreed fixes: tailored resume + cover letter, saved to Drive. */
export async function generateDocsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const back = `/applications/prepare?id=${encodeURIComponent(id)}`;
  let target: string;
  try {
    if (user.demo) {
      const state = await readDemoState();
      const app = demoFindApp(state, id);
      if (!app) throw new Error("Application not found.");
      if (!app.analysis) throw new Error("Run the fit check first.");
      demoSetAppDocs(state, id);
      await writeDemoState(state);
    } else {
      const found = await getApplicationForEmail(user.email, id);
      if (!found) throw new Error("Application not found.");
      if (!found.app.analysis) throw new Error("Run the fit check first.");
      const profile = await getProfileByEmail(user.email);
      if (!profile) throw new Error("Set up your profile first.");
      const job = found.job ?? {
        title: found.app.job_title,
        company: found.app.company,
        location: "",
        description: "",
      };
      const fixes = (JSON.parse(found.app.analysis) as { fixes?: string[] })
        .fixes ?? [];
      const docs = await tailorDocuments(profile, job, fixes);
      const label = `${found.app.job_title} — ${found.app.company}`;
      const [resumeLink, letterLink] = await Promise.all([
        createGoogleDoc(`${label} — Tailored Resume`, docs.tailored_resume),
        createGoogleDoc(`${label} — Cover Letter`, docs.cover_letter),
      ]);
      await updateApplication(found.app, {
        tailored_resume_link: resumeLink,
        cover_letter_link: letterLink,
      });
    }
    target = `${back}&docs=1`;
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `${back}&error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function updateStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = `/applications/prepare?id=${encodeURIComponent(id)}`;
  let target: string;
  try {
    if (!APP_STATUSES.includes(status)) throw new Error("Pick a status.");
    if (user.demo) {
      const state = await readDemoState();
      if (!demoSetAppStatus(state, id, status)) {
        throw new Error("Application not found.");
      }
      await writeDemoState(state);
    } else {
      const found = await getApplicationForEmail(user.email, id);
      if (!found) throw new Error("Application not found.");
      await updateApplication(found.app, { status });
    }
    target = `${back}&status_saved=1`;
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `${back}&error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function applyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/jobs?error=${encodeURIComponent(
        "Sign in first — your profile is what gets submitted."
      )}`
    );
  }
  const jobId = String(formData.get("job_id") ?? "");
  let target: string;
  try {
    if (user!.demo) {
      const state = await readDemoState();
      const result = demoApply(state, jobId);
      await writeDemoState(state);
      target = `/jobs?${result.ok ? "applied" : "error"}=${encodeURIComponent(
        result.message
      )}`;
    } else {
      const result = await applyManually(jobId, user!.email);
      target = `/jobs?${result.ok ? "applied" : "error"}=${encodeURIComponent(
        result.message
      )}`;
    }
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `/jobs?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

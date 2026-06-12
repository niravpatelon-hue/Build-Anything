"use server";

import { Readable } from "node:stream";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getGoogleClients, NotConfiguredError } from "./google";
import { getInfra } from "./db";
import { applyManually, postJob, saveProfile } from "./data";
import { AINotConfiguredError, parseResume } from "./ai";
import { authConfigured, signIn, signOut } from "./auth";
import {
  DEMO_PARSED,
  demoActive,
  demoApply,
  demoPostJob,
  demoSaveProfile,
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
        experience: JSON.stringify(DEMO_PARSED.experience),
        education: JSON.stringify(DEMO_PARSED.education),
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

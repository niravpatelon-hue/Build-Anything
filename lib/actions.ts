"use server";

import { Readable } from "node:stream";
import { redirect } from "next/navigation";
import { getGoogleClients, NotConfiguredError } from "./google";
import { getInfra } from "./db";
import { applyManually, postJob, saveProfile } from "./data";
import { AINotConfiguredError, parseResume } from "./ai";
import { authConfigured, safeAuth, signIn, signOut } from "./auth";

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
  await signOut({ redirectTo: "/" });
}

async function requireEmail(): Promise<string> {
  const session = await safeAuth();
  const email = session?.user?.email;
  if (!email) {
    redirect(
      `/profile?error=${encodeURIComponent("Sign in with Google first.")}`
    );
  }
  return email!;
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
  const email = await requireEmail();
  let target: string;
  try {
    const resume = formData.get("resume");
    if (!(resume instanceof File) || resume.size === 0) {
      throw new Error("Choose a resume file first.");
    }
    if (resume.size > MAX_RESUME_BYTES) {
      throw new Error("Resume is too big — keep it under 4 MB.");
    }

    const buffer = Buffer.from(await resume.arrayBuffer());
    const [parsed, resumeLink] = await Promise.all([
      parseResume(buffer, resume.type, resume.name),
      uploadResumeToDrive(resume, email),
    ]);

    const { autoApplied } = await saveProfile({
      email,
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
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    target = `/profile?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const email = await requireEmail();
  let target: string;
  try {
    const { autoApplied } = await saveProfile({
      email,
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
      auto_apply: formData.get("auto_apply") === "on",
    });
    target = `/profile?saved=1&auto=${autoApplied}`;
  } catch (err) {
    target = `/profile?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function postJobAction(formData: FormData): Promise<void> {
  let target: string;
  try {
    const { autoApplied } = await postJob({
      title: String(formData.get("title") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      salary: String(formData.get("salary") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    });
    target = `/jobs?posted=1&auto=${autoApplied}`;
  } catch (err) {
    target = `/jobs?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

export async function applyAction(formData: FormData): Promise<void> {
  const session = await safeAuth();
  const email = session?.user?.email;
  if (!email) {
    redirect(
      `/jobs?error=${encodeURIComponent(
        "Sign in with Google first — your profile is what gets submitted."
      )}`
    );
  }
  let target: string;
  try {
    const result = await applyManually(
      String(formData.get("job_id") ?? ""),
      email!
    );
    target = `/jobs?${result.ok ? "applied" : "error"}=${encodeURIComponent(
      result.message
    )}`;
  } catch (err) {
    target = `/jobs?error=${encodeURIComponent(friendlyError(err))}`;
  }
  redirect(target);
}

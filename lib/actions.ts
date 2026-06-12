"use server";

import { Readable } from "node:stream";
import { redirect } from "next/navigation";
import { getGoogleClients, NotConfiguredError } from "./google";
import { getInfra } from "./db";
import { applyManually, postJob, saveProfile } from "./data";

const MAX_RESUME_BYTES = 4 * 1024 * 1024; // Vercel request body limit is 4.5 MB

function errorTarget(path: string, err: unknown): string {
  const message =
    err instanceof NotConfiguredError
      ? "setup"
      : "Something went wrong — please try again.";
  return `${path}?error=${encodeURIComponent(message)}`;
}

async function uploadResume(file: File, email: string): Promise<string> {
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

export async function saveProfileAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  let target: string;
  try {
    let resumeLink = "";
    const resume = formData.get("resume");
    if (resume instanceof File && resume.size > 0) {
      if (resume.size > MAX_RESUME_BYTES) {
        redirect(
          `/profile?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
            "Resume is too big — keep it under 4 MB."
          )}`
        );
      }
      resumeLink = await uploadResume(resume, email);
    }

    const { autoApplied } = await saveProfile({
      name: String(formData.get("name") ?? "").trim(),
      email,
      skills: String(formData.get("skills") ?? "").trim(),
      preferred_titles: String(formData.get("preferred_titles") ?? "").trim(),
      preferred_locations: String(
        formData.get("preferred_locations") ?? ""
      ).trim(),
      resume_link: resumeLink,
      auto_apply: formData.get("auto_apply") === "on",
    });
    target = `/profile?email=${encodeURIComponent(email)}&saved=1&auto=${autoApplied}`;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    target = errorTarget(`/profile`, err);
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
    target = errorTarget("/jobs", err);
  }
  redirect(target);
}

export async function applyAction(formData: FormData): Promise<void> {
  let target: string;
  try {
    const result = await applyManually(
      String(formData.get("job_id") ?? ""),
      String(formData.get("email") ?? "")
    );
    target = `/jobs?${result.ok ? "applied" : "error"}=${encodeURIComponent(
      result.message
    )}`;
  } catch (err) {
    target = errorTarget("/jobs", err);
  }
  redirect(target);
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

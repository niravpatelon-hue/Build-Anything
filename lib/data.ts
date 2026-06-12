import { appendRow, readRows, updateRow, type Row } from "./db";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * A profile matches a job when at least one preferred title appears in the
 * job title, or one skill appears in the title/description — and, if the
 * profile lists preferred locations, the job location matches one of them.
 */
export function matches(profile: Row, job: Row): boolean {
  const titles = splitList(profile.preferred_titles ?? "");
  const skills = splitList(profile.skills ?? "");
  const jobTitle = (job.title ?? "").toLowerCase();
  const jobText = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();

  const titleHit = titles.some((t) => jobTitle.includes(t));
  const skillHit = skills.some((s) => jobText.includes(s));
  if (!titleHit && !skillHit) return false;

  const locations = splitList(profile.preferred_locations ?? "");
  if (locations.length > 0) {
    const jobLocation = (job.location ?? "").toLowerCase();
    if (!locations.some((l) => jobLocation.includes(l))) return false;
  }
  return true;
}

async function fileApplication(
  profile: Row,
  job: Row,
  auto: boolean
): Promise<void> {
  await appendRow("applications", {
    id: crypto.randomUUID(),
    job_id: job.id,
    profile_id: profile.id,
    job_title: job.title,
    company: job.company,
    candidate_name: profile.name,
    candidate_email: profile.email,
    status: "submitted",
    auto: auto ? "yes" : "no",
    applied_at: new Date().toISOString(),
  });
}

export async function getProfileByEmail(email: string): Promise<Row | null> {
  const normalized = email.trim().toLowerCase();
  const profiles = await readRows("profiles");
  return (
    profiles.find((p) => p.email.trim().toLowerCase() === normalized) ?? null
  );
}

/** Auto-applies a profile to every open, matching job it hasn't applied to yet. */
export async function autoApplyForProfile(profile: Row): Promise<number> {
  const [jobs, applications] = await Promise.all([
    readRows("jobs"),
    readRows("applications"),
  ]);
  const alreadyApplied = new Set(
    applications.filter((a) => a.profile_id === profile.id).map((a) => a.job_id)
  );

  let count = 0;
  for (const job of jobs) {
    if (job.status !== "open") continue;
    if (alreadyApplied.has(job.id)) continue;
    if (!matches(profile, job)) continue;
    await fileApplication(profile, job, true);
    count++;
  }
  return count;
}

export async function saveProfile(input: {
  name: string;
  email: string;
  skills: string;
  preferred_titles: string;
  preferred_locations: string;
  resume_link: string;
  auto_apply: boolean;
}): Promise<{ autoApplied: number }> {
  const existing = await getProfileByEmail(input.email);
  const data: Record<string, string> = {
    id: existing?.id ?? crypto.randomUUID(),
    name: input.name,
    email: input.email.trim(),
    skills: input.skills,
    preferred_titles: input.preferred_titles,
    preferred_locations: input.preferred_locations,
    resume_link: input.resume_link || existing?.resume_link || "",
    auto_apply: input.auto_apply ? "yes" : "no",
    created_at: existing?.created_at || new Date().toISOString(),
  };

  if (existing) {
    await updateRow("profiles", existing._row, data);
  } else {
    await appendRow("profiles", data);
  }

  let autoApplied = 0;
  if (input.auto_apply) {
    autoApplied = await autoApplyForProfile({ ...data, _row: 0 } as Row);
  }
  return { autoApplied };
}

/** Posts a job, then auto-applies every opted-in matching profile to it. */
export async function postJob(input: {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
}): Promise<{ autoApplied: number }> {
  const job: Record<string, string> = {
    id: crypto.randomUUID(),
    title: input.title,
    company: input.company,
    location: input.location,
    salary: input.salary,
    description: input.description,
    status: "open",
    created_at: new Date().toISOString(),
  };
  await appendRow("jobs", job);

  const profiles = await readRows("profiles");
  let autoApplied = 0;
  for (const profile of profiles) {
    if (profile.auto_apply !== "yes") continue;
    if (!matches(profile, { ...job, _row: 0 } as Row)) continue;
    await fileApplication(profile, { ...job, _row: 0 } as Row, true);
    autoApplied++;
  }
  return { autoApplied };
}

export async function applyManually(
  jobId: string,
  email: string
): Promise<{ ok: boolean; message: string }> {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    return {
      ok: false,
      message: "No profile found for that email — create one first.",
    };
  }
  const [jobs, applications] = await Promise.all([
    readRows("jobs"),
    readRows("applications"),
  ]);
  const job = jobs.find((j) => j.id === jobId);
  if (!job || job.status !== "open") {
    return { ok: false, message: "That job is no longer open." };
  }
  const duplicate = applications.some(
    (a) => a.job_id === jobId && a.profile_id === profile.id
  );
  if (duplicate) {
    return { ok: false, message: "You already applied to that job." };
  }
  await fileApplication(profile, job, false);
  return { ok: true, message: `Applied to ${job.title} at ${job.company}.` };
}

export async function listOpenJobs(): Promise<Row[]> {
  const jobs = await readRows("jobs");
  return jobs.filter((j) => j.status === "open").reverse();
}

export async function listApplicationsForEmail(email: string): Promise<Row[]> {
  const normalized = email.trim().toLowerCase();
  const applications = await readRows("applications");
  return applications
    .filter((a) => a.candidate_email.trim().toLowerCase() === normalized)
    .reverse();
}

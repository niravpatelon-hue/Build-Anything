import { appendRow, readRows, updateRow, type Row } from "./db";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

type MatchableJob = {
  title?: string;
  description?: string;
  location?: string;
  [key: string]: string | number | undefined;
};

/**
 * A profile matches a job when at least one preferred title appears in the
 * job title, or one skill appears in the title/description — and, if the
 * profile lists preferred locations, the job location matches one of them.
 */
export function matches(profile: Row, job: MatchableJob): boolean {
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
    source: job.source ?? "",
    apply_link: job.apply_link ?? "",
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

export type ProfileInput = {
  email: string;
  name?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  skills?: string;
  preferred_titles?: string;
  preferred_locations?: string;
  experience?: string;
  education?: string;
  resume_link?: string;
  auto_apply?: boolean;
};

/** Upserts a profile; fields left undefined keep their existing values. */
export async function saveProfile(
  input: ProfileInput
): Promise<{ autoApplied: number }> {
  const existing = await getProfileByEmail(input.email);
  const keep = (field: string, value: string | undefined) =>
    value !== undefined ? value : (existing?.[field] ?? "");

  const data: Record<string, string> = {
    id: existing?.id ?? crypto.randomUUID(),
    email: input.email.trim(),
    name: keep("name", input.name),
    phone: keep("phone", input.phone),
    location: keep("location", input.location),
    headline: keep("headline", input.headline),
    summary: keep("summary", input.summary),
    skills: keep("skills", input.skills),
    preferred_titles: keep("preferred_titles", input.preferred_titles),
    preferred_locations: keep(
      "preferred_locations",
      input.preferred_locations
    ),
    experience: keep("experience", input.experience),
    education: keep("education", input.education),
    resume_link: keep("resume_link", input.resume_link),
    auto_apply:
      input.auto_apply !== undefined
        ? input.auto_apply
          ? "yes"
          : "no"
        : existing?.auto_apply || "yes",
    created_at: existing?.created_at || new Date().toISOString(),
  };

  if (existing) {
    await updateRow("profiles", existing._row, data);
  } else {
    await appendRow("profiles", data);
  }

  let autoApplied = 0;
  if (data.auto_apply === "yes") {
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
  return jobs
    .filter((j) => j.status === "open" && !j.external_id)
    .reverse();
}

/** Search results live outside the portal — importing one makes it trackable. */
async function importExternalJob(result: {
  external_id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  source: string;
  apply_link: string;
}): Promise<Row> {
  const jobs = await readRows("jobs");
  const existing = jobs.find((j) => j.external_id === result.external_id);
  if (existing) return existing;

  const job: Record<string, string> = {
    id: crypto.randomUUID(),
    title: result.title,
    company: result.company,
    location: result.location,
    salary: result.salary,
    description: result.description,
    status: "open",
    source: result.source,
    apply_link: result.apply_link,
    external_id: result.external_id,
    created_at: new Date().toISOString(),
  };
  await appendRow("jobs", job);
  return { ...job, _row: 0 } as Row;
}

export async function applyToExternalJob(
  email: string,
  result: Parameters<typeof importExternalJob>[0]
): Promise<{ ok: boolean; message: string }> {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    return {
      ok: false,
      message: "Set up your profile first — it's what gets submitted.",
    };
  }
  const job = await importExternalJob(result);
  const applications = await readRows("applications");
  if (
    applications.some(
      (a) => a.job_id === job.id && a.profile_id === profile.id
    )
  ) {
    return { ok: false, message: "You already applied to that job." };
  }
  await fileApplication(profile, job, false);
  return {
    ok: true,
    message: `Applied to ${job.title} at ${job.company} — it's now tracked in My Applications.`,
  };
}

/** Files applications for every search result that matches the profile. */
export async function autoApplyToSearchResults(
  email: string,
  results: Parameters<typeof importExternalJob>[0][]
): Promise<number> {
  const profile = await getProfileByEmail(email);
  if (!profile) return 0;
  const applications = await readRows("applications");
  const appliedJobIds = new Set(
    applications.filter((a) => a.profile_id === profile.id).map((a) => a.job_id)
  );

  let count = 0;
  for (const result of results) {
    if (!matches(profile, result)) continue;
    const job = await importExternalJob(result);
    if (appliedJobIds.has(job.id)) continue;
    await fileApplication(profile, job, true);
    appliedJobIds.add(job.id);
    count++;
  }
  return count;
}

export async function listApplicationsForEmail(email: string): Promise<Row[]> {
  const normalized = email.trim().toLowerCase();
  const applications = await readRows("applications");
  return applications
    .filter((a) => a.candidate_email.trim().toLowerCase() === normalized)
    .reverse();
}

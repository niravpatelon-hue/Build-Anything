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

/**
 * Creates an application row. A "draft" is queued for preparation (no
 * applied_at yet); "submitted" means it's actually been applied to.
 */
async function createApplication(
  profile: Row,
  job: Row,
  opts: { auto: boolean; status: "draft" | "submitted" }
): Promise<string> {
  const id = crypto.randomUUID();
  await appendRow("applications", {
    id,
    job_id: job.id,
    profile_id: profile.id,
    job_title: job.title,
    company: job.company,
    candidate_name: profile.name,
    candidate_email: profile.email,
    status: opts.status,
    auto: opts.auto ? "yes" : "no",
    source: job.source ?? "",
    apply_link: job.apply_link ?? "",
    applied_at: opts.status === "submitted" ? new Date().toISOString() : "",
  });
  return id;
}

export async function getProfileByEmail(email: string): Promise<Row | null> {
  const normalized = email.trim().toLowerCase();
  const profiles = await readRows("profiles");
  return (
    profiles.find((p) => p.email.trim().toLowerCase() === normalized) ?? null
  );
}

/**
 * Auto-prepares a profile against every open, matching job not already in
 * the pipeline: each match becomes a draft application, queued for the user
 * to curate (fit check + tailored resume + cover letter) and then apply.
 */
export async function autoPrepareForProfile(profile: Row): Promise<number> {
  const [jobs, applications] = await Promise.all([
    readRows("jobs"),
    readRows("applications"),
  ]);
  const alreadyInPipeline = new Set(
    applications.filter((a) => a.profile_id === profile.id).map((a) => a.job_id)
  );

  let count = 0;
  for (const job of jobs) {
    if (job.status !== "open") continue;
    if (alreadyInPipeline.has(job.id)) continue;
    if (!matches(profile, job)) continue;
    await createApplication(profile, job, { auto: true, status: "draft" });
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
): Promise<{ prepared: number }> {
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

  let prepared = 0;
  if (data.auto_apply === "yes") {
    prepared = await autoPrepareForProfile({ ...data, _row: 0 } as Row);
  }
  return { prepared };
}

/** Posts a job, then queues a draft for every opted-in matching profile. */
export async function postJob(input: {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
}): Promise<{ prepared: number }> {
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
  let prepared = 0;
  for (const profile of profiles) {
    if (profile.auto_apply !== "yes") continue;
    if (!matches(profile, { ...job, _row: 0 } as Row)) continue;
    await createApplication(profile, { ...job, _row: 0 } as Row, {
      auto: true,
      status: "draft",
    });
    prepared++;
  }
  return { prepared };
}

/**
 * Starts (or resumes) the prepare workflow for a portal-board job. Creates a
 * draft application and returns its id so the caller can open the workspace.
 */
export async function prepareJobApplication(
  jobId: string,
  email: string
): Promise<{ ok: boolean; id?: string; message: string }> {
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
  const existing = applications.find(
    (a) => a.job_id === jobId && a.profile_id === profile.id
  );
  if (existing) {
    return {
      ok: true,
      id: existing.id,
      message: "Picking up where you left off.",
    };
  }
  const id = await createApplication(profile, job, {
    auto: false,
    status: "draft",
  });
  return {
    ok: true,
    id,
    message: `Preparing your application for ${job.title}.`,
  };
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

/**
 * Starts (or resumes) the prepare workflow for a job found by search. Imports
 * the listing, creates a draft, and returns its id for the workspace.
 */
export async function prepareExternalJob(
  email: string,
  result: Parameters<typeof importExternalJob>[0]
): Promise<{ ok: boolean; id?: string; message: string }> {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    return {
      ok: false,
      message: "Set up your profile first — it's what gets submitted.",
    };
  }
  const job = await importExternalJob(result);
  const applications = await readRows("applications");
  const existing = applications.find(
    (a) => a.job_id === job.id && a.profile_id === profile.id
  );
  if (existing) {
    return {
      ok: true,
      id: existing.id,
      message: "Picking up where you left off.",
    };
  }
  const id = await createApplication(profile, job, {
    auto: false,
    status: "draft",
  });
  return {
    ok: true,
    id,
    message: `Preparing your application for ${job.title}.`,
  };
}

/** Queues a draft for every search result that matches the profile. */
export async function prepareSearchResults(
  email: string,
  results: Parameters<typeof importExternalJob>[0][]
): Promise<number> {
  const profile = await getProfileByEmail(email);
  if (!profile) return 0;
  const applications = await readRows("applications");
  const inPipeline = new Set(
    applications.filter((a) => a.profile_id === profile.id).map((a) => a.job_id)
  );

  let count = 0;
  for (const result of results) {
    if (!matches(profile, result)) continue;
    const job = await importExternalJob(result);
    if (inPipeline.has(job.id)) continue;
    await createApplication(profile, job, { auto: true, status: "draft" });
    inPipeline.add(job.id);
    count++;
  }
  return count;
}

/** Marks one prepared application as actually applied. */
export async function submitApplication(app: Row): Promise<void> {
  await updateApplication(app, {
    status: "submitted",
    applied_at: new Date().toISOString(),
  });
}

/** Submits every application currently in the "ready" state. */
export async function submitAllReadyForEmail(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const applications = await readRows("applications");
  const ready = applications.filter(
    (a) =>
      a.candidate_email.trim().toLowerCase() === normalized &&
      a.status === "ready"
  );
  for (const app of ready) {
    await submitApplication(app);
  }
  return ready.length;
}

export async function getApplicationForEmail(
  email: string,
  id: string
): Promise<{ app: Row; job: Row | null } | null> {
  const normalized = email.trim().toLowerCase();
  const applications = await readRows("applications");
  const app = applications.find(
    (a) => a.id === id && a.candidate_email.trim().toLowerCase() === normalized
  );
  if (!app) return null;
  const jobs = await readRows("jobs");
  const job = jobs.find((j) => j.id === app.job_id) ?? null;
  return { app, job };
}

export async function updateApplication(
  app: Row,
  changes: Record<string, string>
): Promise<void> {
  const { _row, ...fields } = app;
  await updateRow("applications", _row, {
    ...(fields as Record<string, string>),
    ...changes,
  });
}

export async function listApplicationsForEmail(email: string): Promise<Row[]> {
  const normalized = email.trim().toLowerCase();
  const applications = await readRows("applications");
  return applications
    .filter((a) => a.candidate_email.trim().toLowerCase() === normalized)
    .reverse();
}

import { cookies } from "next/headers";
import { matches } from "./data";
import type { Row } from "./db";
import type { ParsedResume } from "./ai";

/**
 * Demo mode is active until the Google database credentials are configured.
 * Everything runs on sample data stored in a browser cookie — no Google
 * account, no AI key, no payment needed. Adding the real credentials in
 * Vercel switches the whole app to live mode automatically.
 */
export const demoActive = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

export const DEMO_USER = {
  email: "demo@auto-apply.preview",
  name: "Demo Candidate",
  demo: true as const,
};

const DEMO_JOB_SEED = [
  {
    id: "demo-job-1",
    title: "Data Analyst",
    company: "TechNova",
    location: "London, UK",
    salary: "£45,000",
    description:
      "Build dashboards and reports for product teams. Strong SQL and Excel required; Python a plus.",
    status: "open",
    created_at: "2026-06-10T09:00:00.000Z",

  },
  {
    id: "demo-job-2",
    title: "Business Analyst",
    company: "FinEdge Capital",
    location: "London, UK (Hybrid)",
    salary: "£52,000",
    description:
      "Gather requirements, run stakeholder workshops and turn findings into clear specs. Excel and SQL day to day.",
    status: "open",
    created_at: "2026-06-10T11:30:00.000Z",

  },
  {
    id: "demo-job-3",
    title: "Junior Project Manager",
    company: "BrightWorks",
    location: "Remote",
    salary: "£38,000",
    description:
      "Coordinate delivery across three product squads. Comfortable with Excel trackers, standups and stakeholder management.",
    status: "open",
    created_at: "2026-06-11T08:15:00.000Z",

  },
  {
    id: "demo-job-4",
    title: "Marketing Executive",
    company: "Bloom Agency",
    location: "Manchester, UK",
    salary: "£32,000",
    description:
      "Run social campaigns and email journeys for consumer brands. Copywriting flair essential.",
    status: "open",
    created_at: "2026-06-11T14:45:00.000Z",

  },
  {
    id: "demo-job-5",
    title: "Operations Analyst",
    company: "Northwind Logistics",
    location: "Remote",
    salary: "£41,000",
    description:
      "Analyse delivery performance, find process improvements and own the weekly KPI pack. Excel and SQL heavy.",
    status: "open",
    created_at: "2026-06-12T07:20:00.000Z",

  },
  {
    id: "demo-job-6",
    title: "Senior Data Analyst",
    company: "HealthBridge",
    location: "London, UK",
    salary: "£58,000",
    description:
      "Lead analytics for the patient-care platform. Python, Power BI and a sharp eye for data quality.",
    status: "open",
    created_at: "2026-06-12T10:05:00.000Z",
  },
];

export const DEMO_JOBS: Row[] = DEMO_JOB_SEED.map(
  (job) => ({ ...job, _row: 0 }) as unknown as Row
);

/** The sample profile a resume upload produces while the AI key isn't set. */
export const DEMO_PARSED: ParsedResume = {
  name: "Alex Morgan",
  email: DEMO_USER.email,
  phone: "+44 7700 900123",
  location: "London, UK",
  headline: "Data & Business Analyst",
  summary:
    "Analyst with 6 years' experience turning messy data into clear decisions for finance and retail teams. Comfortable owning reporting end to end — from SQL pipelines to exec-ready dashboards.",
  skills: [
    "excel",
    "sql",
    "python",
    "power bi",
    "data visualisation",
    "stakeholder management",
  ],
  suggested_titles: ["data analyst", "business analyst", "operations analyst"],
  experience: [
    {
      title: "Business Analyst",
      company: "Retail Insights Ltd",
      period: "Mar 2022 – present",
      description:
        "Own weekly trading reports and stakeholder dashboards for 12 retail clients.",
    },
    {
      title: "Data Analyst",
      company: "Citymove Finance",
      period: "Jun 2019 – Mar 2022",
      description:
        "Built the SQL reporting layer and automated month-end packs, saving 3 days per cycle.",
    },
    {
      title: "Analyst Intern",
      company: "Northgate Consulting",
      period: "2018",
      description: "Supported market-entry research for two FTSE 250 clients.",
    },
  ],
  education: [
    {
      degree: "BSc Economics",
      school: "University of Manchester",
      year: "2018",
    },
  ],
};

type DemoApp = {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  status: string;
  auto: string;
  source?: string;
  apply_link?: string;
  applied_at: string;
};

export type DemoState = {
  profile?: Record<string, string>;
  apps: DemoApp[];
  jobs: Row[];
};

const COOKIE = "demo-state";

export async function readDemoState(): Promise<DemoState> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE)?.value;
    if (!raw) return { apps: [], jobs: [] };
    const parsed = JSON.parse(raw) as DemoState;
    return {
      profile: parsed.profile,
      apps: Array.isArray(parsed.apps) ? parsed.apps : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { apps: [], jobs: [] };
  }
}

/** Only callable from server actions (cookies are read-only during render). */
export async function writeDemoState(state: DemoState): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(state), {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
  });
}

export function demoAllJobs(state: DemoState): Row[] {
  return [...state.jobs, ...DEMO_JOBS].filter((j) => j.status === "open");
}

export function demoGetProfile(state: DemoState): Row | null {
  return state.profile ? ({ ...state.profile, _row: 0 } as Row) : null;
}

function fileDemoApplication(
  state: DemoState,
  job: { [key: string]: string | number | undefined },
  auto: boolean
): void {
  state.apps.unshift({
    id: crypto.randomUUID(),
    job_id: String(job.id ?? ""),
    job_title: String(job.title ?? ""),
    company: String(job.company ?? ""),
    status: "submitted",
    auto: auto ? "yes" : "no",
    source: String(job.source ?? ""),
    apply_link: String(job.apply_link ?? ""),
    applied_at: new Date().toISOString(),
  });
  state.apps = state.apps.slice(0, 30);
}

function demoAutoApply(state: DemoState): number {
  const profile = demoGetProfile(state);
  if (!profile || profile.auto_apply !== "yes") return 0;
  const applied = new Set(state.apps.map((a) => a.job_id));
  let count = 0;
  for (const job of demoAllJobs(state)) {
    if (applied.has(job.id)) continue;
    if (!matches(profile, job)) continue;
    fileDemoApplication(state, job, true);
    count++;
  }
  return count;
}

export function demoSaveProfile(
  state: DemoState,
  input: Record<string, string | undefined> & { auto_apply?: string }
): number {
  const existing = state.profile ?? {};
  const keep = (field: string) => input[field] ?? existing[field] ?? "";
  state.profile = {
    id: existing.id ?? crypto.randomUUID(),
    email: DEMO_USER.email,
    name: keep("name"),
    phone: keep("phone"),
    location: keep("location"),
    headline: keep("headline"),
    summary: keep("summary"),
    skills: keep("skills"),
    preferred_titles: keep("preferred_titles"),
    preferred_locations: keep("preferred_locations"),
    experience: keep("experience"),
    education: keep("education"),
    resume_link: keep("resume_link"),
    auto_apply: input.auto_apply ?? existing.auto_apply ?? "yes",
    created_at: existing.created_at ?? new Date().toISOString(),
  };
  return demoAutoApply(state);
}

export function demoApply(
  state: DemoState,
  jobId: string
): { ok: boolean; message: string } {
  const profile = demoGetProfile(state);
  if (!profile || !profile.name) {
    return {
      ok: false,
      message: "Set up your profile first — it's what gets submitted.",
    };
  }
  const job = demoAllJobs(state).find((j) => j.id === jobId);
  if (!job) return { ok: false, message: "That job is no longer open." };
  if (state.apps.some((a) => a.job_id === jobId)) {
    return { ok: false, message: "You already applied to that job." };
  }
  fileDemoApplication(state, job, false);
  return { ok: true, message: `Applied to ${job.title} at ${job.company}.` };
}

export function demoPostJob(
  state: DemoState,
  job: {
    title: string;
    company: string;
    location: string;
    salary: string;
    description: string;
  }
): number {
  state.jobs.unshift({
    id: crypto.randomUUID(),
    title: job.title.slice(0, 80),
    company: job.company.slice(0, 60),
    location: job.location.slice(0, 60),
    salary: job.salary.slice(0, 30),
    description: job.description.slice(0, 280),
    status: "open",
    created_at: new Date().toISOString(),
    _row: 0,
  } as unknown as Row);
  state.jobs = state.jobs.slice(0, 5);
  return demoAutoApply(state);
}

type ExternalJob = {
  external_id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  source: string;
  apply_link: string;
};

export function demoApplyExternal(
  state: DemoState,
  result: ExternalJob
): { ok: boolean; message: string } {
  const profile = demoGetProfile(state);
  if (!profile || !profile.name) {
    return {
      ok: false,
      message: "Set up your profile first — it's what gets submitted.",
    };
  }
  if (state.apps.some((a) => a.job_id === result.external_id)) {
    return { ok: false, message: "You already applied to that job." };
  }
  fileDemoApplication(
    state,
    {
      id: result.external_id,
      title: result.title,
      company: result.company,
      source: result.source,
      apply_link: result.apply_link,
    },
    false
  );
  return {
    ok: true,
    message: `Applied to ${result.title} at ${result.company} — it's now tracked in My Applications.`,
  };
}

export function demoAutoApplySearch(
  state: DemoState,
  results: ExternalJob[]
): number {
  const profile = demoGetProfile(state);
  if (!profile || profile.auto_apply !== "yes") return 0;
  const applied = new Set(state.apps.map((a) => a.job_id));
  let count = 0;
  for (const result of results) {
    if (applied.has(result.external_id)) continue;
    if (!matches(profile, result)) continue;
    fileDemoApplication(
      state,
      {
        id: result.external_id,
        title: result.title,
        company: result.company,
        source: result.source,
        apply_link: result.apply_link,
      },
      true
    );
    count++;
  }
  return count;
}

export function demoApplications(state: DemoState): Row[] {
  return state.apps.map((a) => ({ ...a, profile_id: "", _row: 0 }) as unknown as Row);
}

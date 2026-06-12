/**
 * Job search across the internet via the JSearch aggregator (RapidAPI),
 * which indexes postings from LinkedIn, Indeed, Glassdoor, ZipRecruiter
 * and company career pages.
 */

export class SearchNotConfiguredError extends Error {
  constructor() {
    super("Job search isn't connected yet — set RAPIDAPI_KEY.");
    this.name = "SearchNotConfiguredError";
  }
}

export type SearchResult = {
  external_id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  source: string;
  apply_link: string;
  posted: string;
};

function formatSalary(job: {
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
}): string {
  const { job_min_salary: min, job_max_salary: max } = job;
  if (!min && !max) return "";
  const currency = job.job_salary_currency ?? "";
  const period = job.job_salary_period
    ? ` / ${job.job_salary_period.toLowerCase()}`
    : "";
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  if (min && max) return `${currency} ${fmt(min)}–${fmt(max)}${period}`.trim();
  return `${currency} ${fmt((min || max)!)}${period}`.trim();
}

type JSearchJob = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_description?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
};

export async function searchJobs(
  query: string,
  location: string
): Promise<SearchResult[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new SearchNotConfiguredError();

  const q = location ? `${query} jobs in ${location}` : `${query} jobs`;
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(
    q
  )}&page=1&num_pages=1`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Job search failed (${res.status}) — the job-feed service may be over its free limit. Try again shortly.`
    );
  }
  const body = (await res.json()) as { data?: JSearchJob[] };

  return (body.data ?? []).slice(0, 20).map((job) => {
    const place = job.job_is_remote
      ? "Remote"
      : [job.job_city, job.job_state, job.job_country]
          .filter(Boolean)
          .join(", ");
    return {
      external_id: job.job_id ?? crypto.randomUUID(),
      title: job.job_title ?? "Untitled role",
      company: job.employer_name ?? "Unknown company",
      location: place,
      salary: formatSalary(job),
      description: (job.job_description ?? "").slice(0, 400),
      source: job.job_publisher ?? "Web",
      apply_link: job.job_apply_link ?? "",
      posted: job.job_posted_at_datetime_utc?.slice(0, 10) ?? "",
    };
  });
}

/** Sample search results shown in demo mode (no key needed). */
const DEMO_SEARCH_POOL: SearchResult[] = [
  {
    external_id: "ext-demo-1",
    title: "Data Analyst",
    company: "Monzo",
    location: "London, UK",
    salary: "£48,000–55,000 / year",
    description:
      "Partner with product squads to define metrics, build dashboards in Looker, and run SQL deep-dives that shape the roadmap.",
    source: "LinkedIn",
    apply_link: "https://example.com/demo-postings/data-analyst-monzo",
    posted: "2026-06-11",
  },
  {
    external_id: "ext-demo-2",
    title: "Business Analyst — Operations",
    company: "Ocado Group",
    location: "London, UK (Hybrid)",
    salary: "£50,000 / year",
    description:
      "Map processes across fulfilment centres, gather requirements from stakeholders and turn excel models into business cases.",
    source: "Indeed",
    apply_link: "https://example.com/demo-postings/business-analyst-ocado",
    posted: "2026-06-10",
  },
  {
    external_id: "ext-demo-3",
    title: "Senior Data Analyst",
    company: "Deliveroo",
    location: "Remote (UK)",
    salary: "£60,000–68,000 / year",
    description:
      "Own analytics for the rider experience team. Python, SQL and strong storytelling with data required.",
    source: "Glassdoor",
    apply_link: "https://example.com/demo-postings/senior-data-analyst-deliveroo",
    posted: "2026-06-12",
  },
  {
    external_id: "ext-demo-4",
    title: "Operations Analyst",
    company: "Wise",
    location: "London, UK",
    salary: "£44,000 / year",
    description:
      "Analyse payment operations data, find process improvements, and own weekly KPI reporting in SQL and Excel.",
    source: "Company site",
    apply_link: "https://example.com/demo-postings/operations-analyst-wise",
    posted: "2026-06-09",
  },
  {
    external_id: "ext-demo-5",
    title: "Insights Analyst",
    company: "Sky",
    location: "Leeds, UK",
    salary: "£38,000 / year",
    description:
      "Turn viewing data into insight packs for content teams. Power BI and SQL day to day.",
    source: "LinkedIn",
    apply_link: "https://example.com/demo-postings/insights-analyst-sky",
    posted: "2026-06-08",
  },
  {
    external_id: "ext-demo-6",
    title: "Product Manager",
    company: "Starling Bank",
    location: "London, UK",
    salary: "£70,000 / year",
    description:
      "Lead the savings product squad end to end — discovery, delivery and stakeholder management.",
    source: "Indeed",
    apply_link: "https://example.com/demo-postings/product-manager-starling",
    posted: "2026-06-11",
  },
  {
    external_id: "ext-demo-7",
    title: "Junior Data Analyst",
    company: "NHS Digital",
    location: "Remote (UK)",
    salary: "£30,000 / year",
    description:
      "Support national reporting with SQL queries and Excel dashboards. Great first analyst role with mentoring.",
    source: "ZipRecruiter",
    apply_link: "https://example.com/demo-postings/junior-data-analyst-nhs",
    posted: "2026-06-12",
  },
  {
    external_id: "ext-demo-8",
    title: "Marketing Analytics Executive",
    company: "ASOS",
    location: "Manchester, UK",
    salary: "£35,000 / year",
    description:
      "Measure campaign performance across channels and build attribution reports with the data team.",
    source: "Glassdoor",
    apply_link: "https://example.com/demo-postings/marketing-analytics-asos",
    posted: "2026-06-07",
  },
];

export function demoSearchJobs(
  query: string,
  location: string
): SearchResult[] {
  const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const loc = location.trim().toLowerCase();
  let results = DEMO_SEARCH_POOL.filter((job) => {
    const hay = `${job.title} ${job.description}`.toLowerCase();
    return tokens.length === 0 || tokens.some((t) => hay.includes(t));
  });
  if (loc) {
    const filtered = results.filter((job) =>
      job.location.toLowerCase().includes(loc)
    );
    if (filtered.length > 0) results = filtered;
  }
  return results.length > 0 ? results : DEMO_SEARCH_POOL;
}

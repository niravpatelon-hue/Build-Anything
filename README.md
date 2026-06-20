# Auto-Apply Job Portal

A job portal where candidates set up their profile once and get automatically
applied to jobs that match their preferences.

## How it's built

- **App:** Next.js (TypeScript + Tailwind CSS)
- **Hosting:** Vercel — auto-deploys on every push to GitHub
- **Database:** Google Sheets via the Google Sheets API (service account)
- **File storage:** Google Drive (resumes, documents) via the Google Drive API

## How it works

The model is **prepare first, apply when ready**. A job becomes a *draft*, you
curate it (fit check → tailored resume + cover letter), it turns *ready*, and
only then is it applied — one at a time or all the ready ones in bulk.

- **My Profile** — sign in with Google, upload a resume (stored in Drive) and
  the AI reads it into your profile. The profile is the factual *skeleton*
  (contact, education, and your employment history: employer, role, dates,
  location). The detailed, role-specific experience is written fresh per job.
  Auto-prepare is on by default: matching jobs queue as drafts to review.
- **Find Jobs** — searches listings from across the web (LinkedIn, Indeed,
  Glassdoor, company pages via the JSearch aggregator); "Prepare & apply"
  starts one job, or "Prepare all matching" queues every match as a draft.
- **Job Board** — jobs posted inside the portal; new posts queue a draft for
  every matching opted-in profile.
- **My Applications** — every application tracked by stage (draft → ready to
  apply → applied → …). Each has a Prepare workspace: AI fit check (score,
  strengths, gaps, fixes), then one click writes a tailored resume + cover
  letter (saved as Google Docs in Drive) and marks it ready. Apply a single
  one, or hit "Apply to all ready" to file every prepared application at once.
- **Demo mode** — until credentials are configured the whole portal runs on
  sample data (cookie-based, max 4KB) so it can be explored with zero setup.

> **On fully hands-off applying:** the portal does not create accounts on job
> sites or submit applications on your behalf with stored passwords. Those
> sites (LinkedIn, Indeed, Workday, …) forbid automated submission and block
> it with CAPTCHAs and bot detection, and storing third-party passwords is a
> security liability. Applying opens the real posting with your curated
> documents ready to attach, so the final submit stays a human action.

All data lives in the `auto-apply-job-portal-db` Google Sheet
(tabs: `profiles`, `jobs`, `applications`). The app creates the Sheet, the
Drive folders and all tabs by itself on first use.

## One-time setup

The app needs these environment variables (set them in Vercel → Project →
Settings → Environment Variables):

| Variable | What it is |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the service-account JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the same JSON key |
| `GOOGLE_PROJECTS_FOLDER_ID` | ID of the Drive "Projects" folder shared with the service account |
| `AUTH_SECRET` | Random string used to secure sign-in sessions |
| `AUTH_GOOGLE_ID` | OAuth client ID (Google Cloud → Credentials) |
| `AUTH_GOOGLE_SECRET` | OAuth client secret |
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com) — powers resume reading, fit checks, resume tailoring and cover letters |
| `RAPIDAPI_KEY` | RapidAPI key subscribed to JSearch (free tier) — powers internet-wide job search |

The service account needs the **Google Sheets API** and **Google Drive API**
enabled, and Editor access to the "Projects" folder in Drive. The OAuth
client needs `https://<your-domain>/api/auth/callback/google` as an
authorized redirect URI.

## Environments

- `main` → production
- work branches → Vercel preview deploys

Credentials live in Vercel environment variables, never in this repo.

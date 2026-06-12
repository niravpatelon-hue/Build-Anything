# Auto-Apply Job Portal

A job portal where candidates set up their profile once and get automatically
applied to jobs that match their preferences.

## How it's built

- **App:** Next.js (TypeScript + Tailwind CSS)
- **Hosting:** Vercel — auto-deploys on every push to GitHub
- **Database:** Google Sheets via the Google Sheets API (service account)
- **File storage:** Google Drive (resumes, documents) via the Google Drive API

## How it works

- **My Profile** — sign in with Google, upload a resume (stored in Drive) and
  the AI reads it into a full profile. Auto-apply on by default.
- **Find Jobs** — searches listings from across the web (LinkedIn, Indeed,
  Glassdoor, company pages via the JSearch aggregator); one-click
  apply-and-track, plus bulk auto-apply to everything that matches.
- **Job Board** — jobs posted inside the portal; new posts auto-apply every
  matching opted-in profile.
- **My Applications** — every application tracked with status. Each one has a
  Prepare workspace: AI fit check (score, strengths, gaps, suggested fixes),
  then one click writes a tailored resume + cover letter saved as Google Docs
  in Drive.
- **Demo mode** — until credentials are configured the whole portal runs on
  sample data (cookie-based, max 4KB) so it can be explored with zero setup.

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

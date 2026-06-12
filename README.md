# Auto-Apply Job Portal

A job portal where candidates set up their profile once and get automatically
applied to jobs that match their preferences.

## How it's built

- **App:** Next.js (TypeScript + Tailwind CSS)
- **Hosting:** Vercel — auto-deploys on every push to GitHub
- **Database:** Google Sheets via the Google Sheets API (service account)
- **File storage:** Google Drive (resumes, documents) via the Google Drive API

## How it works

- **My Profile** — candidates save name, skills, preferred titles/locations and
  a resume (uploaded to Google Drive), and switch auto-apply on.
- **Jobs** — anyone can post a job. The moment a job is posted, every opted-in
  profile that matches is applied automatically.
- **My Applications** — candidates see everything they've been applied to.

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
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com) — powers resume reading and, later, resume tailoring, cover letters and interview prep |

The service account needs the **Google Sheets API** and **Google Drive API**
enabled, and Editor access to the "Projects" folder in Drive. The OAuth
client needs `https://<your-domain>/api/auth/callback/google` as an
authorized redirect URI.

## Environments

- `main` → production
- work branches → Vercel preview deploys

Credentials live in Vercel environment variables, never in this repo.

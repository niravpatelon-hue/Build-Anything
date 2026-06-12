# Auto-Apply Job Portal

A job portal where candidates set up their profile once and get automatically
applied to jobs that match their preferences.

## How it's built

- **App:** Next.js (TypeScript + Tailwind CSS)
- **Hosting:** Vercel — auto-deploys on every push to GitHub
- **Database:** Google Sheets via the Google Sheets API (service account)
- **File storage:** Google Drive (resumes, documents) via the Google Drive API

## Environments

- `main` → production
- work branches → Vercel preview deploys

Credentials live in Vercel environment variables, never in this repo.

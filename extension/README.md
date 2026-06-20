# Auto-Apply Assistant — browser extension

A companion to the Auto-Apply Portal. It runs in **your own browser**, fills a
job-application form using your portal profile and the resume & cover letter
you tailored for that job, and then **you review and click submit**.

This is the safe, allowed way to speed up applying. The portal never stores
your LinkedIn/Indeed passwords and never submits on your behalf — job sites
forbid that and block it with bot detection. Here, every submission is still
your own action in your own logged-in browser.

## What it can and can't do

- ✅ Fills standard fields: name, email, phone, location, headline, and pastes
  your tailored cover letter into the right box.
- ✅ One click to copy the cover letter, and links to open your resume &
  cover-letter Google Docs.
- ⚠️ It **cannot attach the resume file** — browsers don't allow any extension
  to set a file upload. Open/download the resume from the popup and attach it
  yourself.
- ⚠️ Some sites (e.g. Workday) use custom widgets it can't always fill. Use
  **Copy** and paste where autofill misses.

## Install (Chrome, Edge, or Brave — about 2 minutes)

1. Download this project to your computer (on GitHub: **Code → Download ZIP**,
   then unzip). You only need the `extension` folder.
2. Open your browser and go to `chrome://extensions`
   (Edge: `edge://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and choose the `extension` folder.
5. The "Auto-Apply Assistant" icon appears in your toolbar. (Click the puzzle
   piece and pin it so it's always visible.)

## Connect it to your portal

1. In the portal, open **My Profile → Connect your browser extension** and copy
   your **access token**. (In demo mode the token is the word `demo`.)
2. Right-click the extension icon → **Options** (or click the icon →
   **Open settings**).
3. Paste your **Portal address** (e.g. `https://your-portal.vercel.app`) and the
   **access token**. Click **Save**.

## Use it

1. Prepare an application in the portal so it has a tailored resume & cover
   letter (status **ready**).
2. Open the real job-application page in your browser.
3. Click the extension icon, pick the job from the dropdown, and hit
   **Autofill this page**.
4. Review every field, **attach your resume**, and submit.

## Updating

When the project changes, re-download it, then on `chrome://extensions` click
the **refresh** icon on the Auto-Apply Assistant card.

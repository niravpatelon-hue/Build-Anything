import { google } from "googleapis";

/** Thrown when the Google credentials haven't been added to the environment yet. */
export class NotConfiguredError extends Error {
  constructor() {
    super(
      "Google credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_PROJECTS_FOLDER_ID."
    );
    this.name = "NotConfiguredError";
  }
}

export function getGoogleClients() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const projectsFolderId = process.env.GOOGLE_PROJECTS_FOLDER_ID;

  if (!email || !rawKey || !projectsFolderId) {
    throw new NotConfiguredError();
  }

  // Vercel env vars may store the key with literal "\n" sequences.
  const key = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
    projectsFolderId,
  };
}

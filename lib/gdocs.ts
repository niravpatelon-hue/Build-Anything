import { Readable } from "node:stream";
import { getGoogleClients } from "./google";
import { getInfra } from "./db";

/**
 * Saves plain text as a real Google Doc inside
 * Projects/auto-apply-job-portal/applications/ and returns its link.
 */
export async function createGoogleDoc(
  name: string,
  text: string
): Promise<string> {
  const { drive } = getGoogleClients();
  const { applicationsFolderId } = await getInfra();
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
      parents: [applicationsFolderId],
    },
    media: {
      mimeType: "text/plain",
      body: Readable.from(Buffer.from(text, "utf-8")),
    },
    fields: "webViewLink",
  });
  return created.data.webViewLink ?? "";
}

import { getGoogleClients } from "./google";

const PROJECT = "auto-apply-job-portal";
const DB_NAME = `${PROJECT}-db`;

export const TABS = {
  profiles: [
    "id",
    "name",
    "email",
    "phone",
    "location",
    "headline",
    "summary",
    "skills",
    "preferred_titles",
    "preferred_locations",
    "experience",
    "education",
    "resume_link",
    "auto_apply",
    "created_at",
  ],
  jobs: [
    "id",
    "title",
    "company",
    "location",
    "salary",
    "description",
    "status",
    "source",
    "apply_link",
    "external_id",
    "created_at",
  ],
  applications: [
    "id",
    "job_id",
    "profile_id",
    "job_title",
    "company",
    "candidate_name",
    "candidate_email",
    "status",
    "auto",
    "source",
    "apply_link",
    "analysis",
    "tailored_resume_link",
    "cover_letter_link",
    "applied_at",
  ],
} as const;

export type TabName = keyof typeof TABS;
export type Row = Record<string, string> & { _row: number };

type Infra = {
  spreadsheetId: string;
  projectFolderId: string;
  uploadsFolderId: string;
  applicationsFolderId: string;
};

let infraPromise: Promise<Infra> | null = null;

async function findOrCreateFolder(
  drive: ReturnType<typeof getGoogleClients>["drive"],
  name: string,
  parentId: string
): Promise<string> {
  const found = await drive.files.list({
    q: `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return created.data.id!;
}

/**
 * Finds — or creates on first run — the Drive folder structure
 * (Projects/auto-apply-job-portal/uploads) and the database spreadsheet
 * with one tab per data type, headers included.
 */
async function setupInfra(): Promise<Infra> {
  const { sheets, drive, projectsFolderId } = getGoogleClients();

  const projectFolderId = await findOrCreateFolder(
    drive,
    PROJECT,
    projectsFolderId
  );
  const uploadsFolderId = await findOrCreateFolder(
    drive,
    "uploads",
    projectFolderId
  );
  const applicationsFolderId = await findOrCreateFolder(
    drive,
    "applications",
    projectFolderId
  );

  let spreadsheetId: string;
  const found = await drive.files.list({
    q: `name = '${DB_NAME}' and '${projectFolderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  const existingSheet = found.data.files?.[0]?.id;
  if (existingSheet) {
    spreadsheetId = existingSheet;
  } else {
    const created = await sheets.spreadsheets.create({
      requestBody: { properties: { title: DB_NAME } },
      fields: "spreadsheetId",
    });
    spreadsheetId = created.data.spreadsheetId!;
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: projectFolderId,
      fields: "id",
    });
  }

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const existingTabs = new Map(
    (meta.data.sheets ?? []).map((s) => [
      s.properties!.title!,
      s.properties!.sheetId!,
    ])
  );

  const addRequests = Object.keys(TABS)
    .filter((tab) => !existingTabs.has(tab))
    .map((tab) => ({ addSheet: { properties: { title: tab } } }));
  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
  }

  for (const [tab, headers] of Object.entries(TABS)) {
    const head = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:Z1`,
    });
    if (!head.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...headers]] },
      });
    }
  }

  // Drop the default empty "Sheet1" so the database stays tidy.
  if (existingTabs.has("Sheet1")) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: existingTabs.get("Sheet1") } }],
        },
      });
    } catch {
      // Non-fatal: a leftover Sheet1 doesn't break anything.
    }
  }

  return {
    spreadsheetId,
    projectFolderId,
    uploadsFolderId,
    applicationsFolderId,
  };
}

export function getInfra(): Promise<Infra> {
  if (!infraPromise) {
    infraPromise = setupInfra().catch((err) => {
      infraPromise = null;
      throw err;
    });
  }
  return infraPromise;
}

export async function readRows(tab: TabName): Promise<Row[]> {
  const { sheets } = getGoogleClients();
  const { spreadsheetId } = await getInfra();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:Z`,
  });
  const [headers = [], ...rows] = (res.data.values ?? []) as string[][];
  return rows.map((r, i) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = r[j] ?? "";
    });
    return { ...obj, _row: i + 2 } as Row;
  });
}

export async function appendRow(
  tab: TabName,
  data: Record<string, string>
): Promise<void> {
  const { sheets } = getGoogleClients();
  const { spreadsheetId } = await getInfra();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [TABS[tab].map((h) => data[h] ?? "")] },
  });
}

export async function updateRow(
  tab: TabName,
  rowNumber: number,
  data: Record<string, string>
): Promise<void> {
  const { sheets } = getGoogleClients();
  const { spreadsheetId } = await getInfra();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [TABS[tab].map((h) => data[h] ?? "")] },
  });
}

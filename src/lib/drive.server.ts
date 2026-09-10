const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const DRIVE = `${GATEWAY}/drive/v3`;
const UPLOAD = `${GATEWAY}/upload/drive/v3/files`;

const ROOT_FOLDER_NAME = "Laporan Lapangan";

function authHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Koneksi Google Drive belum diatur");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
}

async function driveFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Drive error [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : {};
}

/** Accepts a raw ID or any Google Drive folder URL and returns the bare folder ID. */
export function normalizeFolderId(raw: string) {
  let v = raw.trim().replace(/^["']|["']$/g, "");
  const byPath = v.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (byPath) return byPath[1]!;
  const byQuery = v.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (byQuery) return byQuery[1]!;
  if (v.includes("/")) v = v.split("?")[0]!.split("/").filter(Boolean).pop() ?? v;
  const last = v.match(/([A-Za-z0-9_-]{10,})/);
  return last ? last[1]! : v;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findChild(name: string, parentId: string, folderOnly: boolean) {
  const query = [
    `name = '${q(name)}'`,
    `'${q(parentId)}' in parents`,
    "trashed = false",
    folderOnly ? "mimeType = 'application/vnd.google-apps.folder'" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const res = (await driveFetch(
    `${DRIVE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  )) as { files?: { id: string }[] };
  return res.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId?: string) {
  const created = (await driveFetch(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })) as { id: string };
  return created.id;
}

async function ensureFolder(name: string, parentId: string) {
  const existing = await findChild(name, parentId, true);
  return existing ?? createFolder(name, parentId);
}

let cachedRoot: string | null = null;

/** Resolves the "Laporan Lapangan" root folder in the connected Google Drive account. */
async function rootFolderId() {
  if (cachedRoot) return cachedRoot;

  const configured = process.env["GOOGLE_DRIVE_FOLDER_ID"];
  if (configured) {
    const id = normalizeFolderId(configured);
    try {
      await driveFetch(`${DRIVE}/files/${id}?fields=id&supportsAllDrives=true`);
      cachedRoot = id;
      return id;
    } catch {
      // Folder is not reachable with the connected account's grant — fall back below.
    }
  }

  const found = await findChild(ROOT_FOLDER_NAME, "root", true);
  cachedRoot = found ?? (await createFolder(ROOT_FOLDER_NAME));
  return cachedRoot;
}

/** Creates (or reuses) nested folders under the "Laporan Lapangan" root folder. */
export async function ensureFolderPath(path: string[]) {
  let parent = await rootFolderId();
  for (const name of path) parent = await ensureFolder(name.trim() || "TANPA NAMA", parent);
  return parent;
}

async function uploadBytes(
  parentId: string,
  name: string,
  mimeType: string,
  bytes: Uint8Array | string,
  replaceFileId?: string | null,
) {
  const boundary = "lapanganboundary" + Math.random().toString(36).slice(2);
  const meta = replaceFileId ? { name } : { name, parents: [parentId] };
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const body = new Blob([pre, bytes as BlobPart, `\r\n--${boundary}--`]);
  const url = replaceFileId
    ? `${UPLOAD}/${replaceFileId}?uploadType=multipart&supportsAllDrives=true&fields=id`
    : `${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id`;
  const res = await fetch(url, {
    method: replaceFileId ? "PATCH" : "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gagal upload ke Google Drive [${res.status}]: ${text}`);
  return (JSON.parse(text) as { id: string }).id;
}

/** Uploads a file, overwriting any existing file with the same name in the folder. */
export async function upsertFile(
  parentId: string,
  name: string,
  mimeType: string,
  bytes: Uint8Array | string,
) {
  const existing = await findChild(name, parentId, false);
  return uploadBytes(parentId, name, mimeType, bytes, existing);
}

export function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Email of the connected Google Drive account, for the setup panel. */
export async function driveAccount(): Promise<string | null> {
  const res = (await driveFetch(`${DRIVE}/about?fields=user(emailAddress)`)) as {
    user?: { emailAddress?: string };
  };
  return res.user?.emailAddress ?? null;
}

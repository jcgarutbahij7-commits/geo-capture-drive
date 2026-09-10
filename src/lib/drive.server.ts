const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

type ServiceAccount = { client_email: string; private_key: string };

let cachedToken: { token: string; exp: number } | null = null;

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBytes(pem: string) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function serviceAccount(): ServiceAccount {
  const raw = process.env["SERVICE_ACCOUNT_JSON"];
  if (!raw) throw new Error("SERVICE_ACCOUNT_JSON belum diatur");
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("SERVICE_ACCOUNT_JSON tidak valid");
  }
  return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
}

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = serviceAccount();
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/drive",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(sa.private_key) as unknown as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`) as unknown as ArrayBuffer,
  );
  const jwt = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gagal autentikasi Google Drive [${res.status}]: ${text}`);
  const json = JSON.parse(text) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

async function driveFetch(url: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
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

function rootFolderId() {
  const id = process.env["GOOGLE_DRIVE_FOLDER_ID"];
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID belum diatur");
  return normalizeFolderId(id);
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

async function ensureFolder(name: string, parentId: string) {
  const existing = await findChild(name, parentId, true);
  if (existing) return existing;
  const created = (await driveFetch(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  })) as { id: string };
  return created.id;
}

/** Creates (or reuses) nested folders under the "Laporan Lapangan" root folder. */
export async function ensureFolderPath(path: string[]) {
  let parent = rootFolderId();
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
  const token = await getAccessToken();
  const url = replaceFileId
    ? `${UPLOAD}/${replaceFileId}?uploadType=multipart&supportsAllDrives=true&fields=id`
    : `${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id`;
  const res = await fetch(url, {
    method: replaceFileId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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

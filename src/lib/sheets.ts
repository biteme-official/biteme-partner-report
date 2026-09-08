import { createSign } from "crypto";

// 구글 시트를 서비스 계정으로 읽는다.
// googleapis 패키지 없이 node crypto 로 RS256 JWT 를 직접 서명한다.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function loadServiceAccountKey(): ServiceAccountKey {
  const b64 = process.env.GOOGLE_SA_KEY_B64;
  if (!b64) {
    throw new Error("GOOGLE_SA_KEY_B64 환경변수가 없습니다");
  }
  const key = JSON.parse(
    Buffer.from(b64, "base64").toString("utf8")
  ) as ServiceAccountKey;
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SA_KEY_B64 형식이 올바르지 않습니다");
  }
  return key;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const key = loadServiceAccountKey();
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${base64url(signer.sign(key.private_key))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`구글 토큰 발급 실패 (${res.status})`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

export type SheetCell = string | number | boolean;
export type SheetRow = SheetCell[];

// 여러 범위를 한 번에 읽는다. 서식이 아니라 원래 값(UNFORMATTED)을 받는다.
export async function readSheetRanges(
  spreadsheetId: string,
  ranges: string[]
): Promise<SheetRow[][]> {
  const token = await getAccessToken();
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`시트 읽기 실패 (${res.status})`);
  }
  const data = (await res.json()) as {
    valueRanges?: { values?: SheetRow[] }[];
  };
  return ranges.map((_, i) => data.valueRanges?.[i]?.values ?? []);
}

export async function readSheetTitles(spreadsheetId: string): Promise<string[]> {
  const token = await getAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?fields=sheets(properties(title))`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`시트 탭 목록 조회 실패 (${res.status})`);
  }
  const data = (await res.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  return (data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
}

import type { ArcGISTokenResponse, ArcGISUserInfo } from "@/types/arcgis";
import { decrypt, encrypt } from "@/lib/encryption";
import { db } from "@/lib/db";

const AGOL_TOKEN_URL = "https://www.arcgis.com/sharing/rest/oauth2/token";
const AGOL_AUTH_URL = "https://www.arcgis.com/sharing/rest/oauth2/authorize";

let bcAppToken: { token: string; expiry: number } | null = null;
let adminToken: { token: string; expiry: number } | null = null;

/** Fetch or return a cached BC app-level token (client_credentials grant). */
export async function getBCAppToken(): Promise<string> {
  const now = Date.now();
  if (bcAppToken && bcAppToken.expiry > now + 5 * 60 * 1000) {
    return bcAppToken.token;
  }

  const clientId = process.env.ARCGIS_CLIENT_ID!;
  const clientSecret = process.env.ARCGIS_CLIENT_SECRET!;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    f: "json",
  });

  const res = await fetch(AGOL_TOKEN_URL, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    throw new Error(`ArcGIS token request failed: ${res.statusText}`);
  }

  const data: ArcGISTokenResponse = await res.json();
  if (!data.access_token) {
    throw new Error("ArcGIS token response missing access_token");
  }

  bcAppToken = {
    token: data.access_token,
    expiry: now + data.expires_in * 1000,
  };

  return data.access_token;
}

/** Fetch or return a cached token for the BC admin account (used for group management). */
export async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (adminToken && adminToken.expiry > now + 5 * 60 * 1000) {
    return adminToken.token;
  }

  const params = new URLSearchParams({
    username: process.env.ARCGIS_ADMIN_USERNAME!,
    password: process.env.ARCGIS_ADMIN_PASSWORD!,
    client: "referer",
    referer: process.env.ARCGIS_ORG_URL ?? "https://www.arcgis.com",
    expiration: "60",
    f: "json",
  });

  const res = await fetch(
    "https://www.arcgis.com/sharing/rest/generateToken",
    { method: "POST", body: params }
  );
  if (!res.ok) throw new Error(`Admin token request failed: ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`Admin token error: ${data.error.message}`);
  if (!data.token) throw new Error("Admin token response missing token");

  adminToken = { token: data.token, expiry: data.expires };
  return data.token;
}

/** Build the ArcGIS OAuth authorization URL for a user to connect their account. */
export function buildArcGISOAuthURL(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.ARCGIS_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.ARCGIS_OAUTH_REDIRECT_URI!,
    state,
    expiration: "-1",
  });
  return `${AGOL_AUTH_URL}?${params.toString()}`;
}

/** Exchange an authorization code for access + refresh tokens, store them for the user. */
export async function exchangeCodeForTokens(
  userId: string,
  code: string
): Promise<void> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.ARCGIS_CLIENT_ID!,
    client_secret: process.env.ARCGIS_CLIENT_SECRET!,
    redirect_uri: process.env.ARCGIS_OAUTH_REDIRECT_URI!,
    code,
    f: "json",
  });

  const res = await fetch(AGOL_TOKEN_URL, { method: "POST", body: params });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.statusText}`);

  const data: ArcGISTokenResponse = await res.json();
  if (!data.access_token) throw new Error("Token exchange missing access_token");

  // Fetch user info to get orgId and username
  const userInfo = await fetchArcGISUserInfo(data.access_token);

  const orgUrl = process.env.ARCGIS_ORG_URL!;
  const tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

  await db.arcGISAccountLink.upsert({
    where: { userId },
    create: {
      userId,
      username: userInfo.username,
      orgId: userInfo.orgId,
      orgUrl: userInfo.orgUrl ?? orgUrl,
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token ?? ""),
      tokenExpiry,
    },
    update: {
      username: userInfo.username,
      orgId: userInfo.orgId,
      orgUrl: userInfo.orgUrl ?? orgUrl,
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token ?? ""),
      tokenExpiry,
    },
  });
}

/** Get a valid access token for a user, refreshing if necessary. */
export async function getUserToken(userId: string): Promise<string | null> {
  const link = await db.arcGISAccountLink.findUnique({
    where: { userId },
  });
  if (!link) return null;

  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (link.tokenExpiry.getTime() > now.getTime() + fiveMinutes) {
    return decrypt(link.accessToken);
  }

  // Refresh the token
  const refreshToken = decrypt(link.refreshToken);
  if (!refreshToken) return null;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ARCGIS_CLIENT_ID!,
    client_secret: process.env.ARCGIS_CLIENT_SECRET!,
    refresh_token: refreshToken,
    f: "json",
  });

  const res = await fetch(AGOL_TOKEN_URL, { method: "POST", body: params });
  if (!res.ok) return null;

  const data: ArcGISTokenResponse = await res.json();
  if (!data.access_token) return null;

  await db.arcGISAccountLink.update({
    where: { id: link.id },
    data: {
      accessToken: encrypt(data.access_token),
      tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

async function fetchArcGISUserInfo(token: string): Promise<ArcGISUserInfo> {
  const res = await fetch(
    `https://www.arcgis.com/sharing/rest/community/self?f=json&token=${token}`
  );
  if (!res.ok) throw new Error("Failed to fetch ArcGIS user info");
  const data = await res.json();
  return {
    username: data.username,
    fullName: data.fullName,
    email: data.email,
    orgId: data.orgId,
    orgUrl: data.orgUrl,
  };
}

import type { SalesforceTokenResponse } from "@/types/salesforce";

let sfToken: { token: string; instanceUrl: string; expiry: number } | null = null;

/** Get a cached Salesforce access token via client credentials flow. */
export async function getSalesforceToken(): Promise<{
  token: string;
  instanceUrl: string;
}> {
  const now = Date.now();
  if (sfToken && sfToken.expiry > now + 5 * 60 * 1000) {
    return { token: sfToken.token, instanceUrl: sfToken.instanceUrl };
  }

  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL!;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SALESFORCE_CLIENT_ID!,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
  });

  const res = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Salesforce auth failed: ${res.statusText}`);
  }

  const data: SalesforceTokenResponse = await res.json();
  // Salesforce client_credentials tokens are valid for 2 hours
  sfToken = {
    token: data.access_token,
    instanceUrl: data.instance_url,
    expiry: now + 2 * 60 * 60 * 1000,
  };

  return { token: data.access_token, instanceUrl: data.instance_url };
}

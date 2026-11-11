/**
 * Minimal Felt REST API v2 client (https://developers.felt.com).
 *
 * Server-only. FELT_API_TOKEN is a workspace-scoped personal access token that
 * acts as the account that created it and reaches EVERY client's maps — it must
 * never be sent to the browser. Only embed tokens (src/lib/felt/embed.ts) go to
 * clients, and only after an ownership check (src/lib/felt/access.ts).
 */
import "server-only";

const FELT_API_BASE = "https://felt.com/api/v2";

/** Felt's documented limit is 300 req/min per IP; back off on 429. */
const MAX_RETRIES = 3;

export class FeltApiError extends Error {
  status: number;
  code?: string;
  detail?: string;

  constructor(status: number, message: string, code?: string, detail?: string) {
    super(message);
    this.name = "FeltApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

interface FeltErrorEnvelope {
  errors?: Array<{ title?: string; detail?: string; code?: string }>;
}

function getToken(): string {
  const token = process.env.FELT_API_TOKEN;
  if (!token) throw new Error("FELT_API_TOKEN is not configured");
  return token;
}

export function isFeltConfigured(): boolean {
  return !!process.env.FELT_API_TOKEN;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call the Felt API. `path` is relative to /api/v2 (e.g. "/maps/abc").
 *
 * Note Felt's status semantics: permission failures and plan gating return 401
 * (not 403); 403 means a usage limit (storage/processing/data connections).
 */
export async function feltFetch<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(`${FELT_API_BASE}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      // Exponential backoff with jitter: ~1s, 2s, 4s.
      await sleep(2 ** attempt * 1000 + Math.random() * 250);
      continue;
    }

    if (res.status === 204) return undefined as T;

    if (!res.ok) {
      const envelope = (await res.json().catch(() => ({}))) as FeltErrorEnvelope;
      const first = envelope.errors?.[0];
      throw new FeltApiError(
        res.status,
        `Felt API ${init.method ?? "GET"} ${path} failed (${res.status}): ${first?.detail ?? first?.title ?? res.statusText}`,
        first?.code,
        first?.detail
      );
    }

    return (await res.json()) as T;
  }
}
